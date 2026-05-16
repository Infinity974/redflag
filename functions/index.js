/**
 * RedFlag — Cloud Functions Firebase
 *
 * Étapes 5-6 du plan multijoueur :
 *
 * Étape 5 : Validation serveur des actions (empêche la triche)
 *   - onGameAction   → valide et applique une action de jeu
 *   - onTurnTimeout  → force-avance le tour si le joueur ne joue pas
 *
 * Étape 6 : Gestion des présences (reconnexion / kick)
 *   - onPlayerDisconnect → sauvegarde l'état du tour, skip au joueur suivant
 *   - onPlayerReconnect  → restaure le tour si c'était son tour
 *   - onKickTimeout      → kick définitif après KICK_TIMEOUT_MS
 *
 * Architecture : Host-authoritaire + CF de sécurité
 *   - L'host tourne le moteur localement (game-state.js)
 *   - Il écrit publicState/ après chaque action
 *   - Les CF valident l'état et protègent contre les actions invalides
 *   - Les CF gèrent la présence (onDisconnect Firebase)
 *
 * Structure RTDB :
 *   /rooms/{code}/
 *     meta/          → statut, hostUid, createdAt
 *     players/       → nickname, color, isOnline, isHost
 *     publicState/   → état de jeu partagé (sans les mains privées)
 *     privateHands/{uid}/  → main du joueur (sécurisée par RTDB Rules)
 *     actions/       → file d'actions en attente (FIFO)
 *     presence/{uid} → timestamp de dernière activité
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

// =========================================================================
// CONFIG
// =========================================================================
const TURN_TIMEOUT_MS  = 60_000;   // 60s pour jouer avant force-skip
const KICK_TIMEOUT_MS  = 30_000;   // 30s déconnecté → kick
const BASE = 'rooms';

// =========================================================================
// ÉTAPE 5 — VALIDATION DES ACTIONS
// =========================================================================

/**
 * onGameAction
 *
 * Déclenchée quand un client écrit dans /rooms/{code}/actions/{actionId}.
 * Valide l'action, l'applique sur publicState, et nettoie la queue.
 *
 * Format d'une action :
 * {
 *   uid: string,         // Auteur de l'action
 *   type: string,        // 'play_card' | 'end_turn' | 'play_nope' | 'use_shield' ...
 *   payload: object,     // Données spécifiques au type
 *   timestamp: number,   // Date.now() côté client
 * }
 */
exports.onGameAction = functions
  .region('europe-west1')
  .database.ref(`/${BASE}/{code}/actions/{actionId}`)
  .onCreate(async (snap, context) => {
    const { code, actionId } = context.params;
    const action = snap.val();

    if (!action || !action.uid || !action.type) {
      await snap.ref.remove();
      return null;
    }

    try {
      // Charge l'état courant
      const stateSnap = await db.ref(`${BASE}/${code}/publicState`).get();
      const gameState = stateSnap.val();

      if (!gameState || gameState.status === 'ended') {
        await snap.ref.remove();
        return null;
      }

      // Valide et applique l'action
      const result = applyActionToState(gameState, action, code);

      if (!result.success) {
        // Action invalide : log + supprime sans modifier le state
        console.warn(`[${code}] Action invalide (${action.uid}/${action.type}): ${result.error}`);
        await snap.ref.remove();
        return null;
      }

      // Écrit le nouvel état + supprime l'action traitée (transaction)
      await db.ref(`${BASE}/${code}`).update({
        [`publicState`]: result.newState,
        [`actions/${actionId}`]: null,   // Supprime l'action traitée
      });

      // Reset le timer de tour
      if (result.turnAdvanced) {
        await scheduleTurnTimeout(code, result.newState.turn.activePlayerUid);
      }

      return null;
    } catch (err) {
      console.error(`[${code}] Erreur onGameAction:`, err);
      await snap.ref.remove();
      return null;
    }
  });

/**
 * onTurnTimeout (Scheduled via RTDB trigger)
 *
 * Déclenchée quand /rooms/{code}/turnTimeout est écrit.
 * Si l'UID du joueur attendu correspond toujours à l'actif → force end_turn.
 */
exports.onTurnTimeout = functions
  .region('europe-west1')
  .database.ref(`/${BASE}/{code}/turnTimeout`)
  .onWrite(async (change, context) => {
    const { code } = context.params;
    const data = change.after.val();
    if (!data) return null;  // Supprimé → rien à faire

    const { expectedUid, scheduledAt } = data;

    // Charge l'état
    const stateSnap = await db.ref(`${BASE}/${code}/publicState`).get();
    const gameState = stateSnap.val();
    if (!gameState || gameState.status === 'ended') {
      await change.after.ref.remove();
      return null;
    }

    // Si le joueur actif a changé entre-temps → timeout obsolète
    if (gameState.turn.activePlayerUid !== expectedUid) {
      await change.after.ref.remove();
      return null;
    }

    // Vérifie que le timeout est bien écoulé (anti-race condition)
    if (Date.now() - scheduledAt < TURN_TIMEOUT_MS - 5000) {
      return null;  // Trop tôt
    }

    console.log(`[${code}] ⏰ Timeout tour pour ${expectedUid}, force end_turn`);

    // Force end_turn
    const forceAction = {
      uid: expectedUid,
      type: 'end_turn',
      payload: { forced: true },
      timestamp: Date.now(),
    };

    const result = applyActionToState(gameState, forceAction, code);
    if (result.success) {
      await db.ref(`${BASE}/${code}/publicState`).set(result.newState);
      if (result.turnAdvanced) {
        await scheduleTurnTimeout(code, result.newState.turn.activePlayerUid);
      }
    }

    await change.after.ref.remove();
    return null;
  });

// =========================================================================
// ÉTAPE 6 — GESTION DE LA PRÉSENCE / RECONNEXION
// =========================================================================

/**
 * onPresenceWrite
 *
 * Déclenchée quand /rooms/{code}/presence/{uid} change.
 * - Si mis à null (onDisconnect Firebase) → joueur déconnecté
 * - Si mis à un timestamp → joueur connecté / reconnecter
 *
 * ✅ RÈGLE : si joueur actif déconnecté → skip au suivant, save interruptedTurn.
 * ✅ RÈGLE : si joueur actif reconnecte avant le kick → restaure son tour complet.
 * ✅ RÈGLE : si 30s sans reconnexion → kick (ghost).
 */
exports.onPresenceWrite = functions
  .region('europe-west1')
  .database.ref(`/${BASE}/{code}/presence/{uid}`)
  .onWrite(async (change, context) => {
    const { code, uid } = context.params;
    const wasOnline = change.before.exists();
    const isNowOnline = change.after.exists();

    if (wasOnline && !isNowOnline) {
      // Déconnexion
      await handleDisconnect(code, uid);
    } else if (!wasOnline && isNowOnline) {
      // Reconnexion
      await handleReconnect(code, uid);
    } else if (isNowOnline) {
      // Heartbeat : annule un éventuel kick en cours
      await db.ref(`${BASE}/${code}/kickTimers/${uid}`).remove();
    }

    return null;
  });

// =========================================================================
// HANDLERS INTERNES
// =========================================================================

/**
 * Gère la déconnexion d'un joueur.
 * ✅ RÈGLE : si c'était son tour → sauvegarde, skip au suivant, lance le kick timer.
 */
async function handleDisconnect(code, uid) {
  // Met à jour isOnline dans players/
  await db.ref(`${BASE}/${code}/players/${uid}/isOnline`).set(false);

  const stateSnap = await db.ref(`${BASE}/${code}/publicState`).get();
  const gameState = stateSnap.val();
  if (!gameState || gameState.status === 'ended') return;

  const wasActive = gameState.turn.activePlayerUid === uid;

  // Marque le joueur comme déconnecté dans le state partagé
  await db.ref(`${BASE}/${code}/publicState/players/${uid}/isConnected`).set(false);

  if (wasActive) {
    // Sauvegarde le contexte du tour interrompu
    await db.ref(`${BASE}/${code}/publicState/turn`).update({
      disconnectedDuringTurnUid: uid,
      disconnectedAt: admin.database.ServerValue.TIMESTAMP,
    });

    // Avance au joueur suivant (turn timeout court-circuité)
    await db.ref(`${BASE}/${code}/publicState/players/${uid}/isConnected`).set(false);

    // Planifie le passage forcé au joueur suivant dans 5s
    // (laisse le temps aux clients de voir la déco)
    await db.ref(`${BASE}/${code}/forceSkipAfterDisconnect`).set({
      uid,
      scheduledAt: Date.now(),
    });

    console.log(`[${code}] 🔌 ${uid} déconnecté pendant son tour → skip dans 5s`);
  }

  // Lance le kick timer (30s)
  await db.ref(`${BASE}/${code}/kickTimers/${uid}`).set({
    scheduledAt: Date.now(),
    reason: 'disconnect',
  });
}

/**
 * Déclenchée par /rooms/{code}/forceSkipAfterDisconnect
 * Avance le tour si le joueur n'est pas revenu.
 */
exports.onForceSkipAfterDisconnect = functions
  .region('europe-west1')
  .database.ref(`/${BASE}/{code}/forceSkipAfterDisconnect`)
  .onWrite(async (change, context) => {
    const { code } = context.params;
    const data = change.after.val();
    if (!data) return null;

    const { uid, scheduledAt } = data;

    // Attend 5s (delay via Cloud Tasks serait mieux, mais on gère le timing ici)
    if (Date.now() - scheduledAt < 4500) return null;

    const stateSnap = await db.ref(`${BASE}/${code}/publicState`).get();
    const gameState = stateSnap.val();
    if (!gameState) return null;

    // Si le joueur est revenu entre-temps → annule
    if (gameState.players?.[uid]?.isConnected !== false) {
      await change.after.ref.remove();
      return null;
    }

    // Avance au joueur suivant
    const forceAction = {
      uid: gameState.turn.activePlayerUid,  // Peut être différent si déjà avancé
      type: 'advance_after_disconnect',
      payload: { disconnectedUid: uid },
      timestamp: Date.now(),
    };

    const result = applyActionToState(gameState, forceAction, code);
    if (result.success) {
      await db.ref(`${BASE}/${code}/publicState`).set(result.newState);
    }

    await change.after.ref.remove();
    return null;
  });

/**
 * Gère la reconnexion d'un joueur.
 * ✅ RÈGLE : si c'était son tour interrompu → restaure-le.
 */
async function handleReconnect(code, uid) {
  await db.ref(`${BASE}/${code}/players/${uid}/isOnline`).set(true);
  await db.ref(`${BASE}/${code}/kickTimers/${uid}`).remove();

  const stateSnap = await db.ref(`${BASE}/${code}/publicState`).get();
  const gameState = stateSnap.val();
  if (!gameState || gameState.status === 'ended') return;

  // Marque comme connecté
  await db.ref(`${BASE}/${code}/publicState/players/${uid}/isConnected`).set(true);

  // ✅ RÈGLE : si c'était son tour interrompu → restaure le tour complet
  if (gameState.turn?.disconnectedDuringTurnUid === uid) {
    console.log(`[${code}] 🔄 ${uid} reconnecté → tour restauré`);
    await db.ref(`${BASE}/${code}/publicState/turn`).update({
      activePlayerUid: uid,
      greenFlagsPlayedThisTurn: 0,
      redFlagsPlayedThisTurn: 0,
      mustEndTurn: false,
      turnStartedAt: admin.database.ServerValue.TIMESTAMP,
      disconnectedDuringTurnUid: null,
      disconnectedAt: null,
    });

    // Replanifie le timer de tour
    await scheduleTurnTimeout(code, uid);
  }
}

/**
 * Kick timer : si le joueur reste déconnecté trop longtemps → ghost.
 */
exports.onKickTimerWrite = functions
  .region('europe-west1')
  .database.ref(`/${BASE}/{code}/kickTimers/{uid}`)
  .onWrite(async (change, context) => {
    const { code, uid } = context.params;
    const data = change.after.val();
    if (!data) return null;

    const { scheduledAt } = data;
    const elapsed = Date.now() - scheduledAt;

    if (elapsed < KICK_TIMEOUT_MS - 2000) return null;  // Pas encore

    // Vérifie si le joueur est revenu
    const presenceSnap = await db.ref(`${BASE}/${code}/presence/${uid}`).get();
    if (presenceSnap.exists()) {
      await change.after.ref.remove();
      return null;
    }

    // Ghost le joueur
    console.log(`[${code}] 💀 Kick de ${uid} après ${KICK_TIMEOUT_MS / 1000}s hors-ligne`);

    const stateSnap = await db.ref(`${BASE}/${code}/publicState`).get();
    const gameState = stateSnap.val();
    if (!gameState || gameState.status === 'ended') {
      await change.after.ref.remove();
      return null;
    }

    const kickAction = {
      uid: '__system__',
      type: 'kick_player',
      payload: { targetUid: uid },
      timestamp: Date.now(),
    };

    const result = applyActionToState(gameState, kickAction, code);
    if (result.success) {
      await db.ref(`${BASE}/${code}/publicState`).set(result.newState);
    }

    await change.after.ref.remove();
    return null;
  });

// =========================================================================
// MOTEUR D'APPLICATION DES ACTIONS (Serveur)
// =========================================================================

/**
 * Applique une action sur l'état du jeu.
 *
 * Note : côté serveur, on ne peut pas importer directement game-state.js
 * (modules ES vs CommonJS). On réimplémente ici les validations critiques.
 * Le moteur complet reste côté client (l'host). Le serveur fait la
 * validation minimale pour empêcher la triche.
 *
 * @returns {{ success, newState?, error?, turnAdvanced? }}
 */
function applyActionToState(gameState, action, code) {
  // Clone défensif (Firebase renvoie des objets immuables)
  const state = JSON.parse(JSON.stringify(gameState));

  switch (action.type) {

    // -- Jouer une carte --
    case 'play_card': {
      const { uid, payload } = action;
      if (state.turn.activePlayerUid !== uid) {
        return { success: false, error: 'Pas ton tour' };
      }
      if (state.status !== 'playing') {
        return { success: false, error: 'Partie non active' };
      }
      // Validation minimale : Green/Red limit
      const { cardType } = payload;
      if (cardType === 'green_flag' && state.turn.greenFlagsPlayedThisTurn >= 1) {
        return { success: false, error: 'Max 1 Green Flag par tour' };
      }
      if (cardType === 'red_flag' && state.turn.redFlagsPlayedThisTurn >= 1) {
        return { success: false, error: 'Max 1 Red Flag par tour' };
      }
      // L'host a déjà appliqué la logique complète, on accepte son état
      return { success: true, newState: state, turnAdvanced: false };
    }

    // -- Fin de tour --
    case 'end_turn': {
      const { uid } = action;
      if (state.turn.activePlayerUid !== uid && !action.payload?.forced) {
        return { success: false, error: 'Pas ton tour' };
      }
      state.turn.greenFlagsPlayedThisTurn = 0;
      state.turn.redFlagsPlayedThisTurn = 0;
      state.turn.mustEndTurn = false;
      state.turn.crushPlayedThisTurn = [];
      // Avance le joueur (simplified)
      const nextUid = getNextConnectedPlayer(state, uid);
      if (nextUid) {
        state.turn.activePlayerUid = nextUid;
        state.turn.turnNumber = (state.turn.turnNumber || 0) + 1;
        state.turn.turnStartedAt = Date.now();
      }
      return { success: true, newState: state, turnAdvanced: true };
    }

    // -- Nope --
    case 'play_nope': {
      const { uid } = action;
      if (!state.nopeWindow) return { success: false, error: 'Pas de fenêtre Nope' };
      if (!state.nopeWindow.openTo.includes(uid)) {
        return { success: false, error: 'Tu ne peux pas Nope' };
      }
      state.nopeWindow.nopeChain.push({ playerUid: uid, at: Date.now() });
      state.nopeWindow.expiresAt = Date.now() + 3500;
      state.nopeWindow.openTo = Object.keys(state.players).filter(p => p !== uid);
      return { success: true, newState: state, turnAdvanced: false };
    }

    // -- Avance après déconnexion --
    case 'advance_after_disconnect': {
      const { disconnectedUid } = action.payload;
      if (state.turn.activePlayerUid !== disconnectedUid) {
        return { success: false, error: 'Plus actif' };
      }
      const nextUid = getNextConnectedPlayer(state, disconnectedUid);
      if (nextUid) {
        state.turn.activePlayerUid = nextUid;
        state.turn.turnNumber = (state.turn.turnNumber || 0) + 1;
        state.turn.turnStartedAt = Date.now();
        state.turn.greenFlagsPlayedThisTurn = 0;
        state.turn.redFlagsPlayedThisTurn = 0;
        state.turn.mustEndTurn = false;
        state.turn.disconnectedDuringTurnUid = null;
      }
      return { success: true, newState: state, turnAdvanced: true };
    }

    // -- Kick système --
    case 'kick_player': {
      const { targetUid } = action.payload;
      const player = state.players[targetUid];
      if (!player) return { success: false, error: 'Joueur inconnu' };

      player.isGhosted = true;
      player.isConnected = false;

      if (state.turn.disconnectedDuringTurnUid === targetUid) {
        const nextUid = getNextConnectedPlayer(state, targetUid);
        if (nextUid) {
          state.turn.activePlayerUid = nextUid;
          state.turn.turnNumber = (state.turn.turnNumber || 0) + 1;
          state.turn.turnStartedAt = Date.now();
          state.turn.disconnectedDuringTurnUid = null;
          state.turn.disconnectedAt = null;
        }
      }

      // Vérifie fin de partie
      const alive = Object.values(state.players).filter(p => !p.isGhosted);
      if (alive.length === 1) {
        state.status = 'ended';
        state.winner = alive[0].uid;
      }

      return { success: true, newState: state, turnAdvanced: true };
    }

    // -- État complet (sync host) --
    case 'sync_state': {
      // L'host envoie l'état complet → on le valide et on l'applique
      if (action.uid !== code.hostUid && !action.payload?.isHost) {
        return { success: false, error: 'Seul l\'host peut sync l\'état' };
      }
      return { success: true, newState: action.payload.state, turnAdvanced: false };
    }

    default:
      return { success: false, error: `Type d'action inconnu: ${action.type}` };
  }
}

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Retourne l'UID du prochain joueur connecté et non-ghosté.
 */
function getNextConnectedPlayer(state, fromUid) {
  const players = Object.values(state.players)
    .sort((a, b) => a.turnOrder - b.turnOrder);
  const currentIdx = players.findIndex(p => p.uid === fromUid);

  for (let i = 1; i < players.length; i++) {
    const next = players[(currentIdx + i) % players.length];
    if (!next.isGhosted && next.isConnected !== false) {
      return next.uid;
    }
  }
  return null;
}

/**
 * Planifie un timer de tour (écrit dans RTDB, déclenche onTurnTimeout).
 */
async function scheduleTurnTimeout(code, activeUid) {
  await db.ref(`${BASE}/${code}/turnTimeout`).set({
    expectedUid: activeUid,
    scheduledAt: Date.now(),
  });
}
