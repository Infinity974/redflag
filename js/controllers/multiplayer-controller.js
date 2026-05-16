/**
 * RedFlag — Multiplayer Controller P2P (sans Cloud Functions)
 *
 * Hôte autoritaire :
 * - L'hôte garde le state en mémoire et le publie sur Firebase
 * - Les clients lisent le state et envoient des intents (intentions d'action)
 * - L'hôte traite les intents et republie le state
 *
 * 1 seule écriture Firebase par action (au lieu de 5-10 avant)
 */

import * as GameState from '../engine/game-state.js';
import * as Bot from '../engine/bot-ai.js';
import { getCard } from '../data/cards-catalog.js';
import { CARD_TYPES, GAME_STATUS } from '../config/game-constants.js';
import { renderGame } from '../ui/game-renderer.js';
import {
  showTargetPicker, showGameEnd,
} from '../ui/dialog-manager.js';
import { showEpicEffect } from '../ui/epic-effects.js';
import {
  initFirebase,
  rtdbSet, rtdbGet, rtdbUpdate, rtdbPush, rtdbListen, rtdbRemove,
} from '../services/firebase-service.js';
import { sleep } from '../utils/helpers.js';

let state = null;
let mySharedState = null;
let myUid = null;
let roomCode = null;
let isHost = false;
let isProcessing = false;
let selectedCardCode = null;

let unsubState = null;
let unsubIntents = null;
let unsubPlayers = null;       // Surveille la liste des joueurs (pour watchdog)
let watchdogTimer = null;       // Surveille les déconnexions
let myReconnectionTimer = null; // Si je suis déconnecté, ce timer me redonne une chance
let sessionId = 0;
const activeTimers = new Set();

const STATE_PATH = (code) => `rooms/${code}/state`;
const INTENTS_PATH = (code) => `rooms/${code}/intents`;
const PLAYERS_PATH = (code) => `rooms/${code}/players`;
const META_PATH = (code) => `rooms/${code}/meta`;

// Seuils du système de reconnexion
const DISCONNECT_GRACE_MS = 5_000;  // <5s : reconnexion auto
const DISCONNECT_CONFIRM_MS = 60_000; // 5-60s : confirmation
const HOST_TRANSFER_DELAY_MS = 10_000; // Transfert d'hôte si déco hôte > 10s
const WATCHDOG_INTERVAL_MS = 2_000;

function sessionTimeout(cb, delay) {
  const mySession = sessionId;
  const timer = setTimeout(() => {
    activeTimers.delete(timer);
    if (mySession !== sessionId) return;
    cb();
  }, delay);
  activeTimers.add(timer);
  return timer;
}

function cleanupSession() {
  sessionId++;
  for (const t of activeTimers) clearTimeout(t);
  activeTimers.clear();
  if (unsubState) { unsubState(); unsubState = null; }
  if (unsubIntents) { unsubIntents(); unsubIntents = null; }
  if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
  if (myReconnectionTimer) { clearTimeout(myReconnectionTimer); myReconnectionTimer = null; }
}

export async function startMultiplayerGame(code, playerSpecs, options = {}) {
  cleanupSession();
  isProcessing = false;
  selectedCardCode = null;

  const { uid } = await initFirebase();
  myUid = uid;
  roomCode = code;
  isHost = options.hostUid ? (options.hostUid === uid) : (playerSpecs[0].uid === uid);

  if (options.gameConfig?.botLevel) {
    Bot.setBotDifficulty(options.gameConfig.botLevel);
  }

  if (isHost) {
    await startAsHost(code, playerSpecs, options.gameConfig || {});
  } else {
    await startAsClient(code);
  }

  setupInputs();

  // Démarre le watchdog qui surveille les déconnexions et le transfert d'hôte
  startWatchdog(code);
}

async function startAsHost(code, playerSpecs, gameConfig) {
  state = GameState.createInitialState(playerSpecs, gameConfig);
  for (const spec of playerSpecs) {
    if (state.players[spec.uid]) {
      state.players[spec.uid].isBot = !!spec.isBot;
    }
  }

  const traitsAtStart = gameConfig.traitsAtStart || 1;
  for (let i = 0; i < traitsAtStart; i++) {
    if (i > 0) state.currentRound++;
    GameState.revealTraitForCurrentRound(state);
  }
  if (traitsAtStart > 1) {
    state.currentRound = 1;
    state.crush.revealedTraits.forEach((t, i) => {
      t.isNewlyRevealed = (i === state.crush.revealedTraits.length - 1);
    });
  }

  await publishState();
  await rtdbUpdate(`rooms/${code}/meta`, { status: 'playing' });

  unsubIntents = rtdbListen(INTENTS_PATH(code), async (intents) => {
    if (!intents) return;
    for (const [intentId, intent] of Object.entries(intents)) {
      if (!intent || intent.uid === myUid) {
        await rtdbRemove(`${INTENTS_PATH(code)}/${intentId}`);
        continue;
      }
      await processIntent(intentId, intent);
    }
  });

  console.log('🎮 [HOST] Partie démarrée:', code);
  refreshUI();
  scheduleBotTurnIfNeeded();
}

async function startAsClient(code) {
  mySharedState = await rtdbGet(STATE_PATH(code));

  unsubState = rtdbListen(STATE_PATH(code), (newState) => {
    if (!newState) return;
    mySharedState = newState;

    if (newState.status === GAME_STATUS.ENDED) {
      handleGameEnd();
      return;
    }

    refreshUI();
  });

  console.log('🎮 [CLIENT] Connecté');
  refreshUI();
}

async function publishState() {
  if (!isHost || !state) return;
  try {
    await rtdbSet(STATE_PATH(roomCode), JSON.parse(JSON.stringify(state)));
  } catch (err) {
    console.warn('publishState failed:', err);
  }
}

async function processIntent(intentId, intent) {
  if (!isHost || !state) {
    if (intentId.startsWith('local_')) return;
    await rtdbRemove(`${INTENTS_PATH(roomCode)}/${intentId}`);
    return;
  }

  let result = null;
  try {
    switch (intent.type) {
      case 'play_card':
        result = GameState.playCard(state, intent.uid, intent.cardCode, intent.options || {});
        break;
      case 'end_turn':
        result = GameState.endTurn(state, intent.uid);
        break;
      case 'play_nope':
        result = GameState.playNope(state, intent.uid, intent.cardCode);
        break;
      case 'reorder_hand':
        result = GameState.reorderHand(state, intent.uid, intent.newOrder);
        break;
      case 'ghosted_decision':
        result = GameState.handleGhostedDecision(state, intent.uid, intent.useShield, intent.position);
        break;
      case 'crush_steal':
        result = GameState.resolveCrushComboSteal(state, intent.uid, intent.targetUid, intent.handIndex);
        break;
      case 'crush_request':
        result = GameState.resolveCrushComboRequest(state, intent.uid, intent.targetUid, intent.requestedCardCode);
        break;
      case 'favor_give':
        result = GameState.resolveFavor(state, intent.uid, intent.cardCode);
        break;
      case 'alter_future':
        result = GameState.resolveAlterFuture(state, intent.uid, intent.newOrder);
        break;
      case 'shuffle_choice':
        result = GameState.resolveShuffleChoice(state, intent.uid, intent.topCardCode, intent.bottomCardCode);
        break;
    }
  } catch (err) {
    console.error('Erreur intent:', err);
  }

  if (!intentId.startsWith('local_')) {
    await rtdbRemove(`${INTENTS_PATH(roomCode)}/${intentId}`);
  }

  if (result?.success) {
    await publishState();
    refreshUI();

    if (result.gameEnded || state.status === GAME_STATUS.ENDED) {
      handleGameEnd();
      return;
    }

    scheduleBotTurnIfNeeded();
  }
}

async function sendIntent(type, payload = {}) {
  if (isHost) {
    return processIntent('local_' + Date.now(), { uid: myUid, type, ...payload });
  }
  await rtdbPush(INTENTS_PATH(roomCode), {
    uid: myUid,
    type,
    timestamp: Date.now(),
    ...payload,
  });
}

// =========================================================================
// WATCHDOG : détecte les déconnexions et gère le transfert d'hôte
// =========================================================================

let lastSeenCache = {};   // uid -> timestamp (du dernier lastSeen vu)
let playerStates = {};    // uid -> 'online' | 'disconnecting' | 'permanent_disconnect'
let hostTransferTimer = null;
let myDisconnectionPopupOpen = false;

function startWatchdog(code) {
  // S'abonne à la liste des joueurs pour avoir leur lastSeen en temps réel
  unsubPlayers = rtdbListen(PLAYERS_PATH(code), (players) => {
    if (!players) return;

    // Met à jour le cache lastSeen
    for (const [uid, p] of Object.entries(players)) {
      if (!p) continue;
      lastSeenCache[uid] = p.lastSeen || 0;
    }
  });

  // Vérifie périodiquement si quelqu'un est déconnecté
  watchdogTimer = setInterval(() => checkDisconnections(code), WATCHDOG_INTERVAL_MS);
}

async function checkDisconnections(code) {
  const players = await rtdbGet(PLAYERS_PATH(code));
  if (!players) return;
  const meta = await rtdbGet(META_PATH(code));
  if (!meta) return;

  const now = Date.now();
  const hostUid = meta.hostUid;

  for (const [uid, p] of Object.entries(players)) {
    if (!p) continue;
    if (p.isBot) continue;          // Les bots ne sont pas surveillés
    if (uid === myUid) continue;    // Pas moi-même

    const lastSeen = p.lastSeen || 0;
    const timeSinceSeen = now - lastSeen;

    // < 5s : online (statut normal)
    if (timeSinceSeen < DISCONNECT_GRACE_MS) {
      if (playerStates[uid] === 'disconnecting') {
        // Reconnexion détectée pendant la grâce !
        playerStates[uid] = 'online';
        console.log(`[WATCHDOG] ${p.nickname} reconnecté en grâce`);
      }
      continue;
    }

    // 5-60s : disconnecting (état de grâce avec confirmation)
    if (timeSinceSeen < DISCONNECT_CONFIRM_MS) {
      if (playerStates[uid] !== 'disconnecting') {
        playerStates[uid] = 'disconnecting';
        console.log(`[WATCHDOG] ${p.nickname} déconnecté depuis ${Math.floor(timeSinceSeen/1000)}s`);
      }
      // Si l'hôte est en déco depuis HOST_TRANSFER_DELAY_MS, déclenche transfert
      if (uid === hostUid && timeSinceSeen >= HOST_TRANSFER_DELAY_MS) {
        if (!hostTransferTimer) {
          hostTransferTimer = sessionTimeout(() => triggerHostTransfer(code), 100);
        }
      }
      continue;
    }

    // > 60s : déconnexion définitive
    if (playerStates[uid] !== 'permanent_disconnect') {
      playerStates[uid] = 'permanent_disconnect';
      console.log(`[WATCHDOG] ${p.nickname} déconnecté définitivement`);

      // Si je suis l'hôte, je marque ce joueur comme ghosted dans le state
      if (isHost && state && state.players[uid] && !state.players[uid].isGhosted) {
        // Import dynamique pour éviter cycle
        const WC = await import('../engine/win-checker.js');
        WC.markPlayerAsGhosted(state, uid);
        await publishState();
        refreshUI();
      }
    }
  }
}

/**
 * Si l'hôte est déconnecté >10s, on élit le plus ancien humain comme nouvel hôte.
 * Cette fonction est exécutée par TOUS les clients en même temps, mais seul
 * celui qui se considère comme nouveau hôte écrit dans Firebase.
 */
async function triggerHostTransfer(code) {
  hostTransferTimer = null;
  const meta = await rtdbGet(META_PATH(code));
  if (!meta) return;
  const players = await rtdbGet(PLAYERS_PATH(code));
  if (!players) return;

  const oldHostUid = meta.hostUid;

  // Vérifie que l'ancien hôte est toujours déconnecté
  const oldHost = players[oldHostUid];
  const now = Date.now();
  if (!oldHost || (now - (oldHost.lastSeen || 0)) < HOST_TRANSFER_DELAY_MS) {
    return; // Pas vraiment déconnecté, on annule
  }

  // Trouve le joueur humain le plus ancien (par joinedAt) encore connecté
  const candidates = Object.values(players)
    .filter(p => p && !p.isBot && p.uid !== oldHostUid)
    .filter(p => (now - (p.lastSeen || 0)) < DISCONNECT_GRACE_MS)
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

  if (candidates.length === 0) {
    console.log('[HOST TRANSFER] Aucun candidat connecté');
    return;
  }

  const newHostUid = candidates[0].uid;
  console.log(`[HOST TRANSFER] Nouvel hôte : ${candidates[0].nickname}`);

  // Si je suis le nouvel hôte, je prends le rôle
  if (newHostUid === myUid) {
    await rtdbUpdate(META_PATH(code), { hostUid: myUid });
    await rtdbUpdate(`${PLAYERS_PATH(code)}/${oldHostUid}`, { isHost: false });
    await rtdbUpdate(`${PLAYERS_PATH(code)}/${myUid}`, { isHost: true });

    // Devient hôte
    await becomeHost(code);
  }
}

/**
 * Le client qui a été élu nouvel hôte reprend le rôle :
 * - Lit le state depuis Firebase
 * - Démarre la gestion des bots
 * - Écoute les intents
 */
async function becomeHost(code) {
  console.log('[HOST TRANSFER] Je deviens le nouvel hôte');
  isHost = true;

  // Récupère le state global depuis Firebase
  const sharedState = await rtdbGet(STATE_PATH(code));
  if (!sharedState) {
    console.error('[HOST TRANSFER] Pas de state à reprendre');
    return;
  }
  state = sharedState;

  // Désinscrit l'écouteur de state (en tant qu'hôte je gère le state moi-même)
  if (unsubState) {
    unsubState();
    unsubState = null;
  }

  // Écoute les intentions des autres clients
  unsubIntents = rtdbListen(INTENTS_PATH(code), async (intents) => {
    if (!intents) return;
    for (const [intentId, intent] of Object.entries(intents)) {
      if (!intent || intent.uid === myUid) {
        await rtdbRemove(`${INTENTS_PATH(code)}/${intentId}`);
        continue;
      }
      await processIntent(intentId, intent);
    }
  });

  refreshUI();
  scheduleBotTurnIfNeeded();
}

/**
 * Vérifie périodiquement (côté MOI) que je suis bien connecté.
 * Si je perds la connexion, je le sais (Firebase déclenche un event).
 * Si la connexion revient, je vérifie depuis combien de temps j'étais déco
 * et j'affiche la popup appropriée.
 */
function startMyConnectionMonitor() {
  // Surveille mon propre lastSeen écrit par le room-service
  // Si pendant >5s je n'arrive pas à updater, c'est que je suis déco
  let myLastSuccessfulHeartbeat = Date.now();
  const checkInterval = setInterval(async () => {
    if (!roomCode || !myUid) return;
    try {
      const players = await rtdbGet(`${PLAYERS_PATH(roomCode)}/${myUid}`);
      if (players && players.lastSeen) {
        const timeSinceMyLastSeen = Date.now() - players.lastSeen;
        if (timeSinceMyLastSeen < DISCONNECT_GRACE_MS) {
          myLastSuccessfulHeartbeat = Date.now();
        }
      }
    } catch (e) {
      // Pas grave, on retentera
    }
  }, 2000);

  activeTimers.add(checkInterval);
}

function scheduleBotTurnIfNeeded() {
  if (!isHost || !state) return;
  if (state.status === GAME_STATUS.ENDED) return;
  if (state.nopeWindow) return;
  if (state.activeChain && state.activeChain.currentTargetUid !== state.turn.activePlayerUid) return;

  const activeUid = state.turn.activePlayerUid;
  const player = state.players[activeUid];
  if (!player || !player.isBot || player.isGhosted) return;

  const speed = state.config?.gameSpeed || 'normal';
  const mult = speed === 'fast' ? 0.5 : speed === 'long' ? 1.5 : 1;
  const delay = (800 + Math.random() * 700) * mult;

  sessionTimeout(() => {
    if (!state || state.status === GAME_STATUS.ENDED) return;
    if (state.turn.activePlayerUid !== activeUid) {
      scheduleBotTurnIfNeeded();
      return;
    }
    runBotTurn(activeUid).catch(err => console.error('Bot:', err));
  }, delay);
}

async function runBotTurn(botUid) {
  if (!isHost || !state) return;
  if (state.turn.activePlayerUid !== botUid) return;
  const bot = state.players[botUid];
  if (!bot || !bot.isBot || bot.isGhosted) return;

  let safety = 0;
  while (!state.turn.mustEndTurn && safety++ < 4) {
    const decision = Bot.decideBotAction(state, botUid);
    if (decision.action !== 'play') break;
    const card = getCard(decision.cardCode);
    if (!card) break;

    let result;
    if (card.type === CARD_TYPES.CRUSH) {
      const sj = bot.hand.map(c => getCard(c)).filter(c =>
        c && c.type === CARD_TYPES.CRUSH && (c.crushIdentity === card.crushIdentity || c.isJoker)
      );
      if (sj.length < 2 || !sj.some(c => !c.isJoker)) break;
      const codes = sj.slice(0, 2).map(c => c.code);
      result = GameState.playCard(state, botUid, codes[0], { crushCombo: codes });
      if (result.success && result.pendingCombo) {
        const others = Object.values(state.players).filter(p =>
          p.uid !== botUid && !p.isGhosted && p.hand.length > 0
        );
        if (others.length > 0) GameState.resolveCrushComboSteal(state, botUid, others[0].uid);
        else state.pendingCrushCombo = null;
      }
    } else {
      result = GameState.playCard(state, botUid, decision.cardCode, { targetUid: decision.targetUid });
    }

    if (!result?.success) break;

    if (state.pendingShuffle) {
      const dp = state.deck.drawPile;
      if (dp.length >= 2) GameState.resolveShuffleChoice(state, botUid, dp[dp.length-1], dp[0]);
      else state.pendingShuffle = null;
    }
    if (state.pendingFavor) {
      const t = state.players[state.pendingFavor.fromUid];
      if (t && t.hand.length > 0) GameState.resolveFavor(state, state.pendingFavor.fromUid, t.hand[0]);
      else state.pendingFavor = null;
    }
    if (state.pendingAlterFuture) {
      GameState.resolveAlterFuture(state, botUid, state.pendingAlterFuture.cards);
    }
    if (state.publicReveal) state.publicReveal = null;

    if (state.activeChain && state.activeChain.currentTargetUid === botUid) {
      let cs = 0;
      while (state.activeChain && state.activeChain.currentTargetUid === botUid && cs++ < 30) {
        GameState.absorbChain(state, botUid);
        let gs = 0;
        while (state.pendingGhosted && gs++ < 10) {
          const gp = state.pendingGhosted.playerUid;
          const hasShield = state.players[gp].hand.some(c => c.startsWith('BG-'));
          GameState.handleGhostedDecision(state, gp, hasShield, 3);
        }
      }
      break;
    }

    if (state.status === GAME_STATUS.ENDED) break;
    refreshUI();
    await sleep(400);
  }

  if (state.status !== GAME_STATUS.ENDED) {
    const er = GameState.endTurn(state, botUid);
    if (er?.mustHandleGhosted) {
      let gs = 0;
      while (state.pendingGhosted && gs++ < 10) {
        const gp = state.pendingGhosted.playerUid;
        const hasShield = state.players[gp].hand.some(c => c.startsWith('BG-'));
        GameState.handleGhostedDecision(state, gp, hasShield, 3);
        if (state.status === GAME_STATUS.ENDED) break;
      }
    }
    await publishState();
    refreshUI();
  }

  if (state.status === GAME_STATUS.ENDED) {
    handleGameEnd();
    return;
  }

  scheduleBotTurnIfNeeded();
}

// === RENDU UI ===

function getEffectiveState() {
  return isHost ? state : mySharedState;
}

function refreshUI() {
  const s = getEffectiveState();
  if (!s) return;

  let renderableState = s;
  if (!isHost) {
    // Côté client : masque les mains des autres
    renderableState = { ...s, players: {} };
    for (const [uid, player] of Object.entries(s.players)) {
      if (uid === myUid) {
        renderableState.players[uid] = player;
      } else {
        renderableState.players[uid] = {
          ...player,
          hand: Array(player.hand?.length || 0).fill('HIDDEN'),
        };
      }
    }
  }

  renderGame(renderableState, myUid);
  updatePlayButton();
}

function updatePlayButton() {
  const s = getEffectiveState();
  if (!s) return;
  const playBtn = document.getElementById('playBtn');
  if (!playBtn) return;
  const isMyTurn = s.turn.activePlayerUid === myUid;
  const blocked = s.nopeWindow || isProcessing;
  playBtn.disabled = !isMyTurn || blocked || !selectedCardCode;
}

function handleGameEnd() {
  cleanupSession();
  const s = getEffectiveState();
  if (!s) return;

  const winner = s.winner ? s.players[s.winner] : null;
  if (winner) {
    showEpicEffect('victory', {
      icon: '🏆',
      title: 'VICTOIRE',
      subtitle: `${winner.nickname} décroche le date !`,
    });
  } else {
    showEpicEffect('ghosted', { icon: '👻', title: 'TOUS GHOSTÉS' });
  }

  setTimeout(() => {
    showGameEnd(s, s.winner, []);
    requestAnimationFrame(() => {
      const replayBtn = document.getElementById('gameoverReplayBtn');
      if (replayBtn) {
        replayBtn.addEventListener('click', () => {
          window.location.hash = '#/lobby';
        });
      }
    });
  }, 2500);
}

function setupInputs() {
  const playBtn = document.getElementById('playBtn');
  const endTurnBtn = document.getElementById('endTurnBtn');
  const handEl = document.getElementById('playerHand');

  if (playBtn) {
    playBtn.onclick = async () => {
      if (!selectedCardCode || isProcessing) return;
      await handlePlayCard(selectedCardCode);
    };
  }
  if (endTurnBtn) {
    endTurnBtn.onclick = async () => {
      if (isProcessing) return;
      await sendIntent('end_turn');
    };
  }

  // Click sur les cartes de la main pour les sélectionner
  if (handEl) {
    handEl.addEventListener('click', (e) => {
      if (handEl.dataset.dragging === 'true') return;
      const cardEl = e.target.closest('.game-card--in-hand');
      if (!cardEl) return;
      const cardCode = cardEl.dataset.cardCode;
      if (!cardCode) return;

      // Toggle sélection
      if (selectedCardCode === cardCode) {
        selectedCardCode = null;
        cardEl.classList.remove('game-card--selected');
      } else {
        // Désélectionne l'ancienne
        handEl.querySelectorAll('.game-card--selected').forEach(el => {
          el.classList.remove('game-card--selected');
        });
        selectedCardCode = cardCode;
        cardEl.classList.add('game-card--selected');
      }
      updatePlayButton();
    });

    // Drag & drop pour ranger les cartes
    import('../ui/hand-drag-drop.js').then(({ setupHandDragAndDrop }) => {
      setupHandDragAndDrop(handEl, {
        getHand: () => {
          const s = getEffectiveState();
          return s?.players?.[myUid]?.hand;
        },
        setHand: async (newHand) => {
          // Envoie un intent reorder_hand
          await sendIntent('reorder_hand', { newOrder: newHand });
        },
        refresh: () => refreshUI(),
      });
    });
  }

  // Détecte les déconnexions du navigateur
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', onMeWentOffline);
    window.addEventListener('online', onMeWentOnline);
  }
}

let myDisconnectedAt = null;
let myReconnectionPopup = null;

function onMeWentOffline() {
  console.log('[ME] Connexion perdue');
  myDisconnectedAt = Date.now();
}

async function onMeWentOnline() {
  if (!myDisconnectedAt) return;
  const downTime = Date.now() - myDisconnectedAt;
  myDisconnectedAt = null;
  console.log(`[ME] Reconnecté après ${Math.floor(downTime/1000)}s`);

  // < 5s : reconnexion auto, rien à faire
  if (downTime < DISCONNECT_GRACE_MS) {
    console.log('[ME] Reconnexion auto (grâce)');
    return;
  }

  // > 60s : déconnexion définitive (l'autre côté m'a déjà ghosted)
  if (downTime >= DISCONNECT_CONFIRM_MS) {
    showPermanentDisconnectionPopup();
    return;
  }

  // 5-60s : popup de confirmation
  await showReconnectionConfirmation(downTime);
}

function showReconnectionConfirmation(downTime) {
  return new Promise((resolve) => {
    // Crée une popup simple
    const overlay = document.createElement('div');
    overlay.className = 'reconnection-popup-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    `;
    overlay.innerHTML = `
      <div style="background: linear-gradient(135deg, #6B0F4D, #2A0A3A);
                  border: 2px solid #FF4FA3; border-radius: 16px;
                  padding: 32px; max-width: 90vw; width: 400px;
                  text-align: center; color: white;
                  box-shadow: 0 0 60px rgba(255, 79, 163, 0.5);">
        <h2 style="margin: 0 0 16px 0; font-size: 24px;">🔌 Reconnexion détectée</h2>
        <p style="margin: 0 0 24px 0; opacity: 0.9; line-height: 1.5;">
          Tu as été déconnecté pendant <strong>${Math.floor(downTime/1000)}s</strong>.<br>
          Veux-tu reprendre la partie ?
        </p>
        <div style="display: flex; gap: 12px;">
          <button id="reconnectYesBtn" style="flex: 1; padding: 14px; background: #00D4AA;
                  border: none; border-radius: 8px; color: white; font-weight: bold;
                  font-size: 16px; cursor: pointer;">
            ✓ Oui, reprendre
          </button>
          <button id="reconnectNoBtn" style="flex: 1; padding: 14px; background: #555;
                  border: none; border-radius: 8px; color: white; font-weight: bold;
                  font-size: 16px; cursor: pointer;">
            ✕ Quitter
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    myReconnectionPopup = overlay;

    document.getElementById('reconnectYesBtn').onclick = () => {
      overlay.remove();
      myReconnectionPopup = null;
      // Update mon lastSeen pour signaler que je suis revenu
      rtdbUpdate(`${PLAYERS_PATH(roomCode)}/${myUid}`, {
        lastSeen: Date.now(),
        isOnline: true,
      });
      refreshUI();
      resolve(true);
    };

    document.getElementById('reconnectNoBtn').onclick = async () => {
      overlay.remove();
      myReconnectionPopup = null;
      // Quitte la partie
      await leaveMultiplayerGame();
      window.location.hash = '#/home';
      resolve(false);
    };
  });
}

function showPermanentDisconnectionPopup() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.95);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  overlay.innerHTML = `
    <div style="background: linear-gradient(135deg, #4A0E0E, #2A0A0A);
                border: 2px solid #E63946; border-radius: 16px;
                padding: 32px; max-width: 90vw; width: 400px;
                text-align: center; color: white;
                box-shadow: 0 0 60px rgba(230, 57, 70, 0.5);">
      <h2 style="margin: 0 0 16px 0; font-size: 24px;">👻 Tu as été ghosté !</h2>
      <p style="margin: 0 0 24px 0; opacity: 0.9; line-height: 1.5;">
        Ta déconnexion a duré plus de <strong>60 secondes</strong>.<br>
        La partie a continué sans toi.
      </p>
      <button id="dcOkBtn" style="width: 100%; padding: 14px; background: #FF4FA3;
              border: none; border-radius: 8px; color: white; font-weight: bold;
              font-size: 16px; cursor: pointer;">
        D'accord
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('dcOkBtn').onclick = async () => {
    overlay.remove();
    await leaveMultiplayerGame();
    window.location.hash = '#/home';
  };
}

async function handlePlayCard(cardCode) {
  const s = getEffectiveState();
  if (!s) return;
  const card = getCard(cardCode);
  if (!card) return;

  isProcessing = true;
  try {
    let targetUid = null;
    if (card.target === 'opponent' || card.target === 'choice' || card.target === 'hand') {
      targetUid = await showTargetPicker(s, myUid);
      if (!targetUid) { isProcessing = false; return; }
    }

    await sendIntent('play_card', { cardCode, options: { targetUid } });
    selectedCardCode = null;
  } finally {
    isProcessing = false;
    refreshUI();
  }
}

export async function leaveMultiplayerGame() {
  cleanupSession();

  if (isHost && roomCode) {
    try {
      await rtdbUpdate(`rooms/${roomCode}/meta`, { status: 'ended' });
    } catch {}
  }

  state = null;
  mySharedState = null;
  myUid = null;
  roomCode = null;
  isHost = false;
}
