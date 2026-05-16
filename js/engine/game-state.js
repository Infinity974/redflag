/**
 * RedFlag — Game State Manager
 *
 * L'orchestrateur central. Crée et maintient l'état de partie en V1 (en mémoire).
 * En Phase 5, on remplacera juste le stockage par Firebase RTDB sans toucher
 * à la logique.
 *
 * C'est le SEUL endroit qui maintient l'état mutable.
 */

import { GAME_CONFIG, GAME_STATUS } from '../config/game-constants.js';
import { randomCrushProfile } from '../data/crushes-catalog.js';
import { getCard } from '../data/cards-catalog.js';
import {
  buildInitialDeck,
  dealStartingHands,
  insertGhostedCards,
  drawCards,
  discardCard,
  insertGhostedAtPosition,
} from './deck-manager.js';
import {
  resolvePlayCard,
  applyFlip,
} from './card-resolver.js';
import {
  advanceToNextTurn,
  selectTraitToReveal,
  isStunned,
  hasImmunity,
} from './turn-manager.js';

// Re-export pour que le controller puisse appeler GameState.advanceToNextTurn
export { advanceToNextTurn };
import {
  startChain,
  addToChain,
  resolveChain,
  cancelChain,
} from './chain-handler.js';
import {
  detectFlipsForNewTrait,
  detectCriticalHit,
} from './tag-matcher.js';
import {
  checkDateImminent,
  checkGameEnd,
  markPlayerAsGhosted,
} from './win-checker.js';
import { uid as makeUid, deepClone, randomAvatarColor, getAvatarLetter } from '../utils/helpers.js';
import { getTrait } from '../data/traits-catalog.js';
import { CARD_TYPES } from '../config/game-constants.js';

/**
 * Crée un état de partie initial avec les joueurs donnés.
 */
export function createInitialState(playerSpecs, gameConfig = null) {
  // playerSpecs : [{ uid, nickname }, ...]
  // gameConfig (optionnel) : { maxRedFlags, nopeEnabled, traitsAtStart, gameSpeed, botLevel }
  //   Si fourni, override les constantes par défaut pour cette partie.

  // Initialisation des joueurs avec leur ordre
  const players = {};
  playerSpecs.forEach((spec, index) => {
    players[spec.uid] = {
      uid: spec.uid,
      nickname: spec.nickname,
      avatarColor: spec.avatarColor || randomAvatarColor(),
      avatarLetter: getAvatarLetter(spec.nickname),
      turnOrder: index,
      isHost: index === 0,
      isConnected: true,
      isGhosted: false,
      profile: {
        seductionGauge: 0,
        shieldActive: false,
        activeFlags: [],
        comboBonus: 0,
        isDateImminent: false,
        isInDanger: false,           // ≤ -100% → en danger
        dangerStartedAtTurn: null,   // tour où le danger a commencé
      },
      hand: [],
      handVersion: 0,                // incrément à chaque drag&drop / modification
      liveStats: {
        cardsPlayed: 0,
        criticalsLanded: 0,
        shieldsUsed: 0,
        biggestSteal: 0,
      },
    };
  });

  // Distribution
  const playerUids = playerSpecs.map(p => p.uid);
  const { hands, remainingDeck } = dealStartingHands(playerUids);
  const { deck: deckWithGhostes, ghostedCount } = insertGhostedCards(remainingDeck, playerUids.length);

  // Affecte les mains
  for (const [uid, hand] of Object.entries(hands)) {
    players[uid].hand = hand;
    // Le bouclier de départ est en main, mais on l'active aussi sur le profil pour la V1
    // (sinon le joueur DOIT le jouer manuellement → on simplifie)
    // Edit : non, on laisse en main, c'est plus stratégique. Le joueur le pose quand il veut.
  }

  // Profil de Crush aléatoire
  const crushProfile = randomCrushProfile();

  return {
    status: GAME_STATUS.PLAYING,
    currentRound: 1,
    players,
    turn: {
      activePlayerUid: playerUids[0],
      turnNumber: 1,
      turnStartedAt: Date.now(),
      actionsThisTurn: 0,
      stunnedPlayers: [],
      activeImmunities: [],
      immunityNextTurn: [],
      crushPlayedThisTurn: [], // Pour les combos x2/x3
      greenFlagsPlayedThisTurn: 0,
      redFlagsPlayedThisTurn: 0,
      mustEndTurn: false, // Si un Red Flag a été joué, le tour doit se terminer
      // ---- Reconnexion (multijoueur) ----
      disconnectedDuringTurnUid: null, // UID du joueur actif qui s'est déco en cours de tour
      disconnectedAt: null,            // Timestamp de déco (pour le timeout de kick)
    },
    deck: {
      drawPile: deckWithGhostes,
      discardPile: [],
      ghostedRemaining: ghostedCount,
    },
    crush: {
      profileId: crushProfile.id,
      profileData: crushProfile,
      revealedTraits: [],
    },
    activeChain: null,
    lastAction: null,
    actionLog: [],  // Journal complet de toutes les actions (max 50)
    winner: null,
    dateImminent: null,
    pendingGhosted: null, // Quand un joueur vient de piocher Ghosté
    pendingCrushCombo: null, // Quand un combo x2/x3 est déclenché et attend la décision

    // ---- Configuration de la partie (override les constantes par défaut) ----
    config: {
      maxRedFlags: gameConfig?.maxRedFlags ?? GAME_CONFIG.MAX_RED_FLAGS_ON_BOARD,
      nopeEnabled: gameConfig?.nopeEnabled ?? true,
      nopeWindowMs: gameConfig?.nopeEnabled === false ? 0 : GAME_CONFIG.NOPE_RESPONSE_WINDOW_MS,
      traitsAtStart: gameConfig?.traitsAtStart ?? 1,
      gameSpeed: gameConfig?.gameSpeed ?? 'normal',
    },
  };
}

/**
 * Révèle le trait du Crush pour le tour actuel.
 * Appelé au début de chaque nouveau tour de table.
 */
export function revealTraitForCurrentRound(state) {
  // Vérifie qu'on n'a pas déjà révélé un trait pour ce tour
  const round = state.currentRound;
  const alreadyRevealed = state.crush.revealedTraits.some(t => t.revealedAtRound === round);
  if (alreadyRevealed) return null;

  const newTrait = selectTraitToReveal(state);
  if (!newTrait) return null;

  // Retire le flag "newly revealed" des traits précédents
  for (const t of state.crush.revealedTraits) {
    t.isNewlyRevealed = false;
  }
  // Marque le nouveau comme tel pour l'animation côté UI
  newTrait.isNewlyRevealed = true;
  state.crush.revealedTraits.push(newTrait);

  // Détecte les flags qui doivent flipper
  const traitObject = getTrait(newTrait.traitId);
  const flips = [];

  for (const player of Object.values(state.players)) {
    if (player.isGhosted) continue;
    const playerFlips = detectFlipsForNewTrait(player.profile.activeFlags, traitObject);
    for (const flip of playerFlips) {
      const result = applyFlip(player, flip.flagId, flip.newValue);
      if (result) {
        flips.push({ playerUid: player.uid, ...result });
      }
    }
  }

  return {
    revealedTrait: newTrait,
    traitObject,
    flips,
  };
}

/**
 * Action principale : un joueur joue une carte.
 * Retourne le résultat enrichi pour l'UI.
 */
export function playCard(state, playerUid, cardCode, options = {}) {
  // Vérifications
  if (state.status === GAME_STATUS.ENDED) {
    return { success: false, error: 'Partie terminée' };
  }

  const player = state.players[playerUid];
  if (!player || player.isGhosted) {
    return { success: false, error: 'Joueur invalide' };
  }

  // Si une chaîne est active et que ce n'est pas le bon joueur ou pas une carte 📲
  if (state.activeChain) {
    if (state.activeChain.currentTargetUid !== playerUid) {
      return { success: false, error: 'Une chaîne est en cours, attends ton tour' };
    }
    const card = getCard(cardCode);
    // Autorisations pendant une chaîne :
    //  - DRAW : pour la contre-attaque (rajoute à la chaîne)
    //  - SUPER_SKIP : annule la chaîne complète
    const isSuperSkip = card.type === CARD_TYPES.SKIP &&
      (card.code?.startsWith('SUPER') || card.actionEffect === 'super_skip');

    if (card.type !== CARD_TYPES.DRAW && !isSuperSkip) {
      return { success: false, error: 'Tu dois contrer avec une carte 📲 ou un Super Skip ⚡' };
    }
    if (card.type === CARD_TYPES.DRAW) {
      return handleChainCounter(state, playerUid, cardCode);
    }
    // SUPER_SKIP pendant une chaîne : on continue la résolution normale
  }

  // Tour normal : seul le joueur actif peut jouer
  if (state.turn.activePlayerUid !== playerUid) {
    return { success: false, error: "Ce n'est pas ton tour" };
  }

  // Si le tour doit se terminer (Red Flag déjà joué), on bloque
  if (state.turn.mustEndTurn) {
    return { success: false, error: "Tu dois finir ton tour (pioche)" };
  }

  const card = getCard(cardCode);
  if (!card) return { success: false, error: 'Carte inconnue' };

  // ===== RESTRICTION : Limite 1 Green Flag par tour =====
  if (card.type === CARD_TYPES.GREEN_FLAG && (state.turn.greenFlagsPlayedThisTurn || 0) >= 1) {
    return {
      success: false,
      error: 'Tu as déjà joué un Green Flag ce tour (max 1).',
    };
  }

  // ===== RESTRICTION : Limite 1 Red Flag par tour =====
  if (card.type === CARD_TYPES.RED_FLAG && (state.turn.redFlagsPlayedThisTurn || 0) >= 1) {
    return {
      success: false,
      error: 'Tu as déjà joué un Red Flag ce tour (max 1).',
    };
  }

  // ===== RESTRICTION : NOPE ne se joue qu'en fenêtre Nope (via playNope) =====
  if (card.type === CARD_TYPES.NOPE) {
    return {
      success: false,
      error: 'Le Nope ne se joue que pour annuler une action en cours.',
    };
  }

  // ===== RESTRICTION : Bouclier ne peut PAS être posé volontairement =====
  if (card.type === CARD_TYPES.SHIELD) {
    return {
      success: false,
      error: 'Le Bouclier ne se joue que face à une carte Ghosté piochée.',
    };
  }

  // ===== RESTRICTION : Crush exige un combo (x2 ou x3) =====
  // On accepte la carte uniquement si options.crushCombo est fourni avec
  // au moins 2 cartes du même type (ou Joker)
  if (card.type === CARD_TYPES.CRUSH) {
    if (!options.crushCombo || !Array.isArray(options.crushCombo) || options.crushCombo.length < 2) {
      return {
        success: false,
        error: 'Une carte Crush ne se joue qu\'en combo (×2 minimum).',
      };
    }
    return handlePlayCrushCombo(state, playerUid, options.crushCombo, options);
  }

  // Si c'est une carte 📲, démarrer une chaîne
  if (card.type === CARD_TYPES.DRAW) {
    return handleStartChain(state, playerUid, cardCode, options.targetUid);
  }

  // Détermine la cible si pas spécifiée
  let targetUid = options.targetUid;
  if (card.target === 'next_player') {
    targetUid = computeNextPlayerUid(state, playerUid);
  }

  // Vérifications de conditional/target
  if (card.type === CARD_TYPES.CONDITIONAL) {
    const activeTraits = (state.crush.revealedTraits || [])
      .filter(t => t.isActive)
      .map(t => getTrait(t.traitId))
      .filter(Boolean);
    // Conditionnelle : toujours jouable — l'effet s'inverse si condition non remplie
    // (évaluation faite dans card-resolver directement)
  }

  // Délégue au card-resolver
  const result = resolvePlayCard({
    gameState: state,
    playerUid,
    cardCode,
    targetUid,
    options,
  });

  if (!result.success) return result;

  // Trace la dernière action (utile pour l'UI)
  const actionEntry = {
    actionType: 'play_card',
    playerUid,
    cardCode,
    targetUid,
    effects: result.effects,
    timestamp: Date.now(),
  };
  state.lastAction = actionEntry;
  // Journal persistant (max 50 entrées)
  if (!state.actionLog) state.actionLog = [];
  state.actionLog.unshift(actionEntry);
  if (state.actionLog.length > 50) state.actionLog.length = 50;

  // Stats
  player.liveStats.cardsPlayed++;
  if (result.effects.some(e => e.isCritical)) {
    player.liveStats.criticalsLanded++;
  }

  // ⚠️ NOUVELLE RÈGLE : on ne défausse PLUS les Green/Red Flags qui sont posés sur un board.
  // Ils restent visibles dans `activeFlags` du joueur ciblé.
  // En revanche, on défausse les autres types (Action, Shield, Conditional appliqué)
  if (card.type === CARD_TYPES.ACTION || card.type === CARD_TYPES.SHIELD || card.type === CARD_TYPES.SKIP) {
    state.deck.discardPile = discardCard(state.deck.discardPile, cardCode, playerUid);
  } else if (card.type === CARD_TYPES.CONDITIONAL) {
    // Les conditionnelles posent aussi un flag sur le board (déjà géré dans card-resolver)
    // On ne les défausse pas, elles deviennent un flag posé.
  }
  // Les Green/Red Flags ne sont PAS défaussés ici, ils sont devenus des flags actifs.

  // Vérifie Date Imminent
  for (const p of Object.values(state.players)) {
    if (!p.isGhosted && checkDateImminent(state, p.uid) && !state.dateImminent) {
      state.dateImminent = {
        playerUid: p.uid,
        startedAtTurn: state.turn.turnNumber,
        startedAtRound: state.currentRound,
      };
      result.dateImminentTriggered = p.uid;
    }
  }

  // ✅ RÈGLES : 1 Green Flag max par tour, 1 Red Flag max par tour.
  // Ces cartes ne passent PAS le tour — le joueur peut continuer à jouer ensuite.
  // Le tour se termine uniquement en piochant ou en jouant une carte "passe-tour".
  if (card.type === CARD_TYPES.GREEN_FLAG) {
    state.turn.greenFlagsPlayedThisTurn = (state.turn.greenFlagsPlayedThisTurn || 0) + 1;
  }
  if (card.type === CARD_TYPES.RED_FLAG) {
    state.turn.redFlagsPlayedThisTurn = (state.turn.redFlagsPlayedThisTurn || 0) + 1;
    // PAS de mustEndTurn : le joueur peut encore jouer d'autres cartes ce tour
  }

  // Vérifie fin de partie
  const endCheck = checkGameEnd(state);
  if (endCheck) {
    state.status = GAME_STATUS.ENDED;
    state.winner = endCheck.playerUid;
    state.endedAt = Date.now();
    result.gameEnded = endCheck;
  }

  return result;
}

/**
 * Joue un combo Crush : valide les cartes, les défausse toutes,
 * détermine le niveau (x2 ou x3) en tenant compte du Joker, et
 * marque l'action en attente pour le pick utilisateur.
 *
 * @param {string[]} cardCodes - 2 ou 3 codes de cartes Crush (incluant éventuellement un Joker)
 */
function handlePlayCrushCombo(state, playerUid, cardCodes, options) {
  const player = state.players[playerUid];

  // Valide que toutes les cartes sont en main et sont des Crush
  const cards = [];
  for (const code of cardCodes) {
    const idx = player.hand.indexOf(code);
    if (idx === -1) {
      return { success: false, error: `Carte ${code} absente de la main` };
    }
    const c = getCard(code);
    if (!c || c.type !== CARD_TYPES.CRUSH) {
      return { success: false, error: `${code} n'est pas une carte Crush` };
    }
    cards.push({ code, card: c, idx });
  }

  // Vérifie le combo : toutes même identité OU Joker(s) qui complètent
  const nonJokers = cards.filter(c => !c.card.isJoker);
  const jokers = cards.filter(c => c.card.isJoker);

  let comboIdentity;
  if (nonJokers.length === 0) {
    // Que des Jokers ?  Refusé — on doit avoir au moins 1 vraie identité
    return { success: false, error: 'Combo de Jokers seuls non autorisé' };
  }
  comboIdentity = nonJokers[0].card.crushIdentity;
  // Tous les non-Jokers doivent avoir la même identité
  if (nonJokers.some(c => c.card.crushIdentity !== comboIdentity)) {
    return { success: false, error: 'Combo invalide : identités différentes' };
  }

  const comboLevel = cards.length; // 2 ou 3

  // Retire les cartes de la main (en partant de la fin pour pas perdre les indices)
  const sortedIdx = cards.map(c => c.idx).sort((a, b) => b - a);
  for (const idx of sortedIdx) {
    player.hand.splice(idx, 1);
  }
  player.handVersion = (player.handVersion || 0) + 1;

  // Défausse les cartes
  for (const { code } of cards) {
    state.deck.discardPile = discardCard(state.deck.discardPile, code, playerUid);
  }
  player.liveStats.cardsPlayed += cards.length;

  state.lastAction = {
    actionType: 'play_crush_combo',
    playerUid,
    cardCodes,
    crushIdentity: comboIdentity,
    comboLevel,
    timestamp: Date.now(),
  };

  state.pendingCrushCombo = {
    level: comboLevel,
    playerUid,
    identity: comboIdentity,
  };

  return {
    success: true,
    isCrush: true,
    crushIdentity: comboIdentity,
    comboLevel,
    pendingCombo: { level: comboLevel },
    effects: [{ type: 'crush_combo_played', identity: comboIdentity, level: comboLevel }],
  };
}


/**
 * Résout un combo Crush x2 : vol une carte aléatoire.
 */
/**
 * Résout un combo Crush x2 : vol une carte par index (ou random si pas spécifié).
 * Retourne la "shape" de la main de la cible (positions visibles côté joueur)
 * pour permettre l'animation de pick.
 */
export function resolveCrushComboSteal(state, playerUid, targetUid, handIndex = null) {
  const combo = state.pendingCrushCombo;
  if (!combo || combo.playerUid !== playerUid || combo.level !== 2) {
    return { success: false, error: 'Pas de combo x2 en attente' };
  }

  const target = state.players[targetUid];
  const player = state.players[playerUid];

  if (!target || target.isGhosted || target.hand.length === 0) {
    state.pendingCrushCombo = null;
    return { success: false, error: 'Cible invalide ou main vide' };
  }

  // Soit l'index est fourni (clic sur dos précis), soit random
  let chosenIdx;
  if (handIndex !== null && handIndex >= 0 && handIndex < target.hand.length) {
    chosenIdx = handIndex;
  } else {
    chosenIdx = Math.floor(Math.random() * target.hand.length);
  }

  const stolenCode = target.hand.splice(chosenIdx, 1)[0];
  player.hand.push(stolenCode);
  target.handVersion = (target.handVersion || 0) + 1;
  player.handVersion = (player.handVersion || 0) + 1;

  state.pendingCrushCombo = null;

  return {
    success: true,
    type: 'crush_combo_steal_random',
    stolenCardCode: stolenCode,
    fromUid: targetUid,
    toUid: playerUid,
    chosenIndex: chosenIdx,
  };
}

/**
 * Résout un combo Crush x3 : demande une carte précise.
 */
export function resolveCrushComboRequest(state, playerUid, targetUid, requestedCardCode) {
  const combo = state.pendingCrushCombo;
  if (!combo || combo.playerUid !== playerUid || combo.level !== 3) {
    return { success: false, error: 'Pas de combo x3 en attente' };
  }

  const target = state.players[targetUid];
  const player = state.players[playerUid];

  if (!target || target.isGhosted) {
    state.pendingCrushCombo = null;
    return { success: false, error: 'Cible invalide' };
  }

  // La cible a-t-elle cette carte ?
  const handIdx = target.hand.indexOf(requestedCardCode);
  if (handIdx === -1) {
    state.pendingCrushCombo = null;
    return {
      success: true,
      type: 'crush_combo_request_failed',
      requestedCardCode,
      fromUid: targetUid,
      toUid: playerUid,
    };
  }

  // Transfert
  target.hand.splice(handIdx, 1);
  player.hand.push(requestedCardCode);

  state.pendingCrushCombo = null;

  return {
    success: true,
    type: 'crush_combo_request_success',
    cardCode: requestedCardCode,
    fromUid: targetUid,
    toUid: playerUid,
  };
}

/**
 * Démarre une chaîne de pioche.
 */
function handleStartChain(state, playerUid, cardCode, targetUid) {
  const card = getCard(cardCode);

  // Cible par défaut : joueur suivant
  if (!targetUid) {
    targetUid = computeNextPlayerUid(state, playerUid);
  }

  // Retire la carte de la main
  const player = state.players[playerUid];
  const handIdx = player.hand.indexOf(cardCode);
  if (handIdx === -1) return { success: false, error: 'Carte absente de la main' };
  player.hand.splice(handIdx, 1);

  state.deck.discardPile = discardCard(state.deck.discardPile, cardCode, playerUid);

  const result = startChain(state, playerUid, cardCode, targetUid);
  state.lastAction = {
    actionType: 'chain_started',
    playerUid,
    cardCode,
    targetUid,
    timestamp: Date.now(),
  };

  player.liveStats.cardsPlayed++;
  return result;
}

/**
 * Le joueur ciblé contre la chaîne avec sa propre carte 📲.
 */
function handleChainCounter(state, playerUid, cardCode) {
  const player = state.players[playerUid];
  const handIdx = player.hand.indexOf(cardCode);
  if (handIdx === -1) return { success: false, error: 'Carte absente de la main' };
  player.hand.splice(handIdx, 1);

  state.deck.discardPile = discardCard(state.deck.discardPile, cardCode, playerUid);

  const result = addToChain(state, playerUid, cardCode);
  state.lastAction = {
    actionType: 'chain_continued',
    playerUid,
    cardCode,
    timestamp: Date.now(),
  };

  player.liveStats.cardsPlayed++;
  return result;
}

/**
 * Le joueur ciblé subit la chaîne et pioche les cartes une par une.
 * Retourne la liste des cartes piochées + détecte les Ghosté.
 */
export function absorbChain(state, playerUid) {
  const chain = state.activeChain;
  if (!chain || chain.currentTargetUid !== playerUid) {
    return { success: false, error: 'Pas de chaîne à absorber' };
  }

  const totalToDraw = chain.totalToDraw;
  const isAllTarget = chain.targetType === 'all';
  const selfPenalty = chain.selfPenalty || 0;
  const originPlayerUid = chain.originPlayerUid;
  const player = state.players[playerUid];
  const drawnCards = [];
  let ghostedAt = -1;

  for (let i = 0; i < totalToDraw; i++) {
    if (state.deck.drawPile.length === 0) break;

    const { drawnCards: drawn, remainingDeck } = drawCards(state.deck.drawPile, 1);
    state.deck.drawPile = remainingDeck;

    const drawnCode = drawn[0];
    drawnCards.push(drawnCode);

    if (drawnCode === 'GHOSTED') {
      ghostedAt = i;
      state.pendingGhosted = {
        playerUid,
        drawnDuringChain: true,
        chainRemainingCards: totalToDraw - i - 1,
      };
      break;
    } else {
      player.hand.push(drawnCode);
    }
  }

  player.handVersion = (player.handVersion || 0) + 1;

  // ✅ FIX PC-04 Storm de Notifs: si targetType='all', tous les autres joueurs piochent aussi 1 carte
  if (isAllTarget) {
    for (const [uid, p] of Object.entries(state.players)) {
      if (uid === playerUid || p.isGhosted) continue;
      if (state.deck.drawPile.length === 0) break;
      const { drawnCards: d2, remainingDeck: rd2 } = drawCards(state.deck.drawPile, 1);
      state.deck.drawPile = rd2;
      if (d2[0] !== 'GHOSTED') {
        p.hand.push(d2[0]);
        p.handVersion = (p.handVersion || 0) + 1;
      }
    }
  }

  // ✅ FIX PC-05 Super Like Inverse: l'initiateur pioche selfPenalty cartes
  if (selfPenalty > 0 && originPlayerUid && originPlayerUid !== playerUid) {
    const origin = state.players[originPlayerUid];
    if (origin && !origin.isGhosted) {
      for (let s = 0; s < selfPenalty; s++) {
        if (state.deck.drawPile.length === 0) break;
        const { drawnCards: ds, remainingDeck: rds } = drawCards(state.deck.drawPile, 1);
        state.deck.drawPile = rds;
        if (ds[0] !== 'GHOSTED') {
          origin.hand.push(ds[0]);
          origin.handVersion = (origin.handVersion || 0) + 1;
        }
      }
    }
  }

  if (ghostedAt === -1) {
    state.activeChain = null;
  }

  return {
    success: true,
    drawnCards,
    ghostedAt,
    totalDrawn: drawnCards.length,
    isAllTarget,
    selfPenalty,
    originPlayerUid,
  };
}

/**
 * Le joueur courant pioche sa carte de fin de tour.
 */
export function drawEndOfTurn(state, playerUid) {
  const player = state.players[playerUid];
  if (!player) return { success: false };

  // ⚠️ Si la pioche est vide, reshuffler la défausse (sauf cartes "spéciales")
  if (state.deck.drawPile.length === 0) {
    if (state.deck.discardPile && state.deck.discardPile.length > 0) {
      // Récupère les codes de cartes (pas les objets {code, ...} si jamais)
      const reshuffleCards = state.deck.discardPile
        .map(entry => typeof entry === 'string' ? entry : entry?.cardCode)
        .filter(c => c && c !== 'GHOSTED');
      if (reshuffleCards.length > 0) {
        // Mélange Fisher-Yates
        for (let i = reshuffleCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [reshuffleCards[i], reshuffleCards[j]] = [reshuffleCards[j], reshuffleCards[i]];
        }
        state.deck.drawPile = reshuffleCards;
        state.deck.discardPile = [];
      } else {
        return { success: true, drawnCards: [], deckEmpty: true };
      }
    } else {
      return { success: true, drawnCards: [], deckEmpty: true };
    }
  }

  const { drawnCards, remainingDeck } = drawCards(state.deck.drawPile, 1);
  state.deck.drawPile = remainingDeck;

  const drawnCode = drawnCards[0];

  if (drawnCode === 'GHOSTED') {
    state.pendingGhosted = {
      playerUid,
      drawnDuringChain: false,
    };
    return {
      success: true,
      drawnGhosted: true,
      pendingGhosted: state.pendingGhosted,
    };
  }

  player.hand.push(drawnCode);
  player.handVersion = (player.handVersion || 0) + 1;  // ✅ force re-render de la main
  return { success: true, drawnCards };
}

/**
 * Le joueur a pioché une Ghosté. S'il a un bouclier en main, il peut
 * la défausser (la Ghosté est replacée à une position de son choix).
 * Sinon, il est éliminé.
 */
export function handleGhostedDecision(state, playerUid, useShield = false, replaceAtPosition = null) {
  const pending = state.pendingGhosted;
  if (!pending || pending.playerUid !== playerUid) {
    return { success: false, error: 'Pas de Ghosté en attente' };
  }

  const player = state.players[playerUid];

  if (useShield) {
    // Cherche un bouclier en main
    const shieldIdx = player.hand.findIndex(code => {
      const card = getCard(code);
      return card && card.type === CARD_TYPES.SHIELD;
    });

    if (shieldIdx === -1) {
      // Vérifie si le joueur a un bouclier déjà ACTIF sur son profil
      if (player.profile.shieldActive) {
        player.profile.shieldActive = false;
      } else {
        return { success: false, error: 'Pas de bouclier disponible' };
      }
    } else {
      // Consomme le bouclier de la main
      const shieldCode = player.hand[shieldIdx];
      player.hand.splice(shieldIdx, 1);
      state.deck.discardPile = discardCard(state.deck.discardPile, shieldCode, playerUid);
    }

    // Replace la Ghosté dans le deck
    const position = replaceAtPosition !== null ? replaceAtPosition : Math.floor(Math.random() * state.deck.drawPile.length);
    state.deck.drawPile = insertGhostedAtPosition(state.deck.drawPile, position);

    state.pendingGhosted = null;
    player.liveStats.shieldsUsed++;

    // Si on était en chaîne, on reprend la pioche
    if (pending.drawnDuringChain && pending.chainRemainingCards > 0) {
      // Le joueur doit continuer à piocher les cartes restantes de la chaîne
      const additionalDraw = absorbRemainingChain(state, playerUid, pending.chainRemainingCards);
      return {
        success: true,
        shielded: true,
        position,
        additionalDraw,
      };
    }

    return { success: true, shielded: true, position };
  }

  // Pas de bouclier ou choix de ne pas l'utiliser → joueur éliminé
  const ghostedResult = markPlayerAsGhosted(state, playerUid);
  state.pendingGhosted = null;
  state.deck.ghostedRemaining = Math.max(0, state.deck.ghostedRemaining - 1);

  // Si on était en chaîne, on annule le reste
  if (pending.drawnDuringChain) {
    state.activeChain = null;
  }

  // Vérifie fin de partie
  const endCheck = checkGameEnd(state);
  if (endCheck) {
    state.status = GAME_STATUS.ENDED;
    state.winner = endCheck.playerUid;
    state.endedAt = Date.now();
    return {
      success: true,
      ghosted: true,
      breakupSMS: ghostedResult.breakupSMS,
      gameEnded: endCheck,
    };
  }

  return {
    success: true,
    ghosted: true,
    breakupSMS: ghostedResult.breakupSMS,
  };
}

/**
 * Reprend la pioche d'une chaîne après gestion d'une Ghosté.
 */
function absorbRemainingChain(state, playerUid, remainingCards) {
  const player = state.players[playerUid];
  const drawn = [];

  for (let i = 0; i < remainingCards; i++) {
    if (state.deck.drawPile.length === 0) break;
    const { drawnCards, remainingDeck } = drawCards(state.deck.drawPile, 1);
    state.deck.drawPile = remainingDeck;
    const code = drawnCards[0];
    drawn.push(code);

    if (code === 'GHOSTED') {
      state.pendingGhosted = {
        playerUid,
        drawnDuringChain: true,
        chainRemainingCards: remainingCards - i - 1,
      };
      // Note : la chaîne reste active tant qu'on a un pendingGhosted ;
      // handleGhostedDecision la nettoiera si élimination, ou continuera la pioche.
      return { drawn, ghostedAt: i };
    }

    player.hand.push(code);
  }

  state.activeChain = null;
  return { drawn, ghostedAt: -1 };
}

/**
 * Défausse une carte (sans la jouer).
 */
export function discardFromHand(state, playerUid, cardCode) {
  const player = state.players[playerUid];
  if (!player) return { success: false };

  const idx = player.hand.indexOf(cardCode);
  if (idx === -1) return { success: false, error: 'Carte absente' };

  player.hand.splice(idx, 1);
  state.deck.discardPile = discardCard(state.deck.discardPile, cardCode, playerUid);

  state.lastAction = {
    actionType: 'discard',
    playerUid,
    cardCode,
    timestamp: Date.now(),
  };

  return { success: true };
}

/**
 * Termine le tour du joueur courant. Appelle automatiquement
 * la pioche de fin de tour, l'avancement, et la révélation de trait.
 */
/**
 * Réordonne la main d'un joueur (drag & drop).
 * Le nouvel ordre doit contenir exactement les mêmes cartes que la main actuelle.
 */
/**
 * Résout la carte "Mélanger" : le joueur a choisi 1ère et dernière carte.
 * Le reste du deck est mélangé aléatoirement entre les deux.
 */
export function resolveShuffleChoice(state, playerUid, topCardCode, bottomCardCode) {
  if (!state.pendingShuffle || state.pendingShuffle.playerUid !== playerUid) {
    return { success: false, error: 'Pas de Mélange en attente.' };
  }

  const drawPile = [...state.deck.drawPile];
  const topIdx = drawPile.indexOf(topCardCode);
  const bottomIdx = drawPile.indexOf(bottomCardCode);

  if (topIdx === -1 || bottomIdx === -1) {
    return { success: false, error: 'Carte choisie absente du deck.' };
  }
  if (topCardCode === bottomCardCode) {
    return { success: false, error: 'Choisis 2 cartes différentes.' };
  }

  // Retire les 2 cartes choisies
  const remaining = drawPile.filter((c, idx) => idx !== topIdx && idx !== bottomIdx);

  // Mélange le reste (Fisher-Yates)
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  // Reconstruit : [bottom, ...mélangé, top]
  // Le sommet du deck = fin du tableau drawPile
  state.deck.drawPile = [bottomCardCode, ...remaining, topCardCode];
  state.pendingShuffle = null;

  return { success: true };
}

/**
 * Résout la carte "Faveur" : le joueur ciblé donne une carte au demandeur.
 */
export function resolveFavor(state, donorUid, donatedCardCode) {
  const pending = state.pendingFavor;
  if (!pending || pending.targetUid !== donorUid) {
    return { success: false, error: 'Pas de Faveur en attente.' };
  }

  const donor = state.players[donorUid];
  const requester = state.players[pending.requesterUid];

  if (!donor || !requester) {
    return { success: false, error: 'Joueur invalide.' };
  }

  const handIdx = donor.hand.indexOf(donatedCardCode);
  if (handIdx === -1) {
    return { success: false, error: 'Carte absente de la main.' };
  }

  donor.hand.splice(handIdx, 1);
  requester.hand.push(donatedCardCode);
  donor.handVersion = (donor.handVersion || 0) + 1;
  requester.handVersion = (requester.handVersion || 0) + 1;

  state.pendingFavor = null;

  return {
    success: true,
    cardCode: donatedCardCode,
    fromUid: donorUid,
    toUid: pending.requesterUid,
  };
}

/**
 * Résout le peek de la dernière carte du deck.
 * Le joueur a vu la carte et décide de la prendre ou non.
 * Dans tous les cas, le tour est déjà skipé (skipDraw posé dans card-resolver).
 */
export function resolvePeekBottom(state, playerUid, take) {
  const pending = state.pendingPeekBottom;
  if (!pending || pending.playerUid !== playerUid) {
    return { success: false, error: 'Pas de peek en attente' };
  }
  state.pendingPeekBottom = null;
  if (!take) return { success: true, took: false };

  const drawPile = state.deck.drawPile;
  if (drawPile.length === 0 || drawPile[0] !== pending.cardCode) {
    return { success: false, error: 'Carte plus disponible' };
  }

  const code = drawPile.shift();
  const player = state.players[playerUid];
  if (!player) return { success: false };

  if (code === 'GHOSTED') {
    state.pendingGhosted = { playerUid, drawnDuringChain: false };
    return { success: true, took: true, drawnGhosted: true };
  }

  player.hand.push(code);
  player.handVersion = (player.handVersion || 0) + 1;
  return { success: true, took: true, cardCode: code };
}

/**
 * Résout "Changer l'avenir" : le joueur réordonne les 3 prochaines cartes.
 * newOrder = [code1, code2, code3] dans l'ordre où elles seront piochées
 * (code1 = prochaine, code3 = 3e prochaine).
 */
export function resolveAlterFuture(state, playerUid, newOrder) {
  const pending = state.pendingAlterFuture;
  if (!pending || pending.playerUid !== playerUid) {
    return { success: false, error: 'Pas de Changement en attente.' };
  }

  if (!Array.isArray(newOrder) || newOrder.length !== pending.cards.length) {
    return { success: false, error: 'Ordre invalide.' };
  }

  // Vérification : les codes doivent être ceux de pending.cards
  const sorted1 = [...newOrder].sort();
  const sorted2 = [...pending.cards].sort();
  for (let i = 0; i < sorted1.length; i++) {
    if (sorted1[i] !== sorted2[i]) {
      return { success: false, error: 'Cartes non identiques à celles révélées.' };
    }
  }

  // Replace dans le deck (rappel : sommet = fin du tableau)
  const drawPile = [...state.deck.drawPile];
  // Retire les 3 premières "prochaines" (= 3 dernières du tableau)
  drawPile.splice(drawPile.length - pending.cards.length, pending.cards.length);

  // Ajoute newOrder en sens inverse pour que newOrder[0] soit la prochaine piochée
  // newOrder[0] = top, donc en dernier dans le tableau
  for (let i = newOrder.length - 1; i >= 0; i--) {
    drawPile.push(newOrder[i]);
  }

  state.deck.drawPile = drawPile;
  state.pendingAlterFuture = null;

  return { success: true };
}

export function reorderHand(state, playerUid, newOrder) {
  const player = state.players[playerUid];
  if (!player) return { success: false, error: 'Joueur inconnu' };

  // Validation : même set de cartes
  if (newOrder.length !== player.hand.length) {
    return { success: false, error: 'Taille différente' };
  }

  const currentSet = [...player.hand].sort();
  const newSet = [...newOrder].sort();
  for (let i = 0; i < currentSet.length; i++) {
    if (currentSet[i] !== newSet[i]) {
      return { success: false, error: 'Cartes différentes' };
    }
  }

  player.hand = [...newOrder];
  player.handVersion = (player.handVersion || 0) + 1;
  return { success: true, handVersion: player.handVersion };
}

/**
 * Récupère la "shape" de la main d'un opponent : juste le nombre de cartes
 * dans leur ordre actuel. Sert pour l'animation Combo x2.
 */
export function getOpponentHandShape(state, opponentUid) {
  const opp = state.players[opponentUid];
  if (!opp) return null;
  return {
    handLength: opp.hand.length,
    handVersion: opp.handVersion || 0,
  };
}

/**
 * Ouvre une fenêtre Nope : l'action est en sursis pendant N millisecondes.
 * Tous les joueurs (sauf l'auteur) peuvent jouer un Nope pour annuler.
 *
 * Stocke les info nécessaires pour rejouer ou annuler l'action après le timer.
 */
/**
 * Ouvre une fenêtre Nope : l'action est en sursis pendant NOPE_RESPONSE_WINDOW_MS (5s).
 *
 * ✅ RÈGLES :
 * - Pendant la fenêtre, PERSONNE (humain ou bot) ne peut jouer (isProcessing = true côté controller).
 * - Chaque Nope joué relance le timer pour 5s supplémentaires.
 * - La carte attaquante ET chaque Nope joué sont défaussés (consommés même si annulés).
 * - Chaîne impaire = action annulée, paire = action rétablie.
 */
export function openNopeWindow(state, sourcePlayerUid, actionDescriptor) {
  // Si Nope désactivé dans la config, on ne déclenche pas la fenêtre
  // (l'action passe immédiatement)
  if (state.config?.nopeEnabled === false) {
    return null;
  }

  const allOthers = Object.values(state.players)
    .filter(p => !p.isGhosted && p.uid !== sourcePlayerUid)
    .map(p => p.uid);

  state.nopeWindow = {
    actionDescriptor,
    sourcePlayerUid,
    openTo: allOthers,
    nopeChain: [],
    expiresAt: Date.now() + (state.config?.nopeWindowMs ?? GAME_CONFIG.NOPE_RESPONSE_WINDOW_MS),
    phase: 'initial',
  };

  return state.nopeWindow;
}

/**
 * Un joueur joue un Nope dans la fenêtre.
 *
 * ✅ RÈGLES :
 * - La carte Nope est IMMÉDIATEMENT défaussée (consommée quoi qu'il arrive).
 * - Chaque Nope relance le timer de 5s pour permettre un contre-Nope.
 * - Le joueur qui vient de Noper ne peut pas re-Noper immédiatement.
 */
export function playNope(state, playerUid, nopeCardCode) {
  const window = state.nopeWindow;
  if (!window) {
    return { success: false, error: 'Pas de fenêtre Nope ouverte.' };
  }

  if (!window.openTo.includes(playerUid)) {
    return { success: false, error: 'Tu ne peux pas Nope cette action.' };
  }

  const player = state.players[playerUid];
  if (!player) return { success: false };

  const handIdx = player.hand.indexOf(nopeCardCode);
  if (handIdx === -1) {
    return { success: false, error: 'Carte Nope absente de ta main.' };
  }

  // ✅ Carte Nope consommée immédiatement
  player.hand.splice(handIdx, 1);
  player.handVersion = (player.handVersion || 0) + 1;
  state.deck.discardPile = discardCard(state.deck.discardPile, nopeCardCode, playerUid);

  window.nopeChain.push({ playerUid, nopeCardCode, at: Date.now() });

  // ✅ Ajoute au journal de partie
  if (!state.actionLog) state.actionLog = [];
  state.actionLog.unshift({
    actionType: 'nope',
    playerUid,
    cardCode: nopeCardCode,
    effects: [{ type: 'nope_played', nopeCount: window.nopeChain.length, isCanceled: window.nopeChain.length % 2 === 1 }],
    timestamp: Date.now(),
  });
  if (state.actionLog.length > 50) state.actionLog.length = 50;

  // ✅ Timer relancé à 5s pour permettre un contre-Nope
  window.phase = 'counter';
  window.expiresAt = Date.now() + (state.config?.nopeWindowMs ?? GAME_CONFIG.NOPE_RESPONSE_WINDOW_MS);

  // Recalcule openTo : tout le monde sauf celui qui vient de Noper
  window.openTo = Object.values(state.players)
    .filter(p => !p.isGhosted && p.uid !== playerUid)
    .map(p => p.uid);

  return {
    success: true,
    nopeCount: window.nopeChain.length,
    isCanceled: window.nopeChain.length % 2 === 1,
    expiresAt: window.expiresAt,
  };
}

/**
 * Force la fermeture immédiate de la fenêtre Nope (expire le timer).
 * Utilisé pour les tests et cas d'urgence.
 * Avec le nouveau modèle à timer fixe, ce n'est plus utilisé en jeu normal.
 */
export function passNopeCounter(state, playerUid) {
  const window = state.nopeWindow;
  if (!window) return { success: false };
  if (!window.openTo.includes(playerUid)) {
    return { success: false, error: 'Tu ne peux pas fermer cette fenêtre.' };
  }
  // Force l'expiration immédiate
  window.expiresAt = Date.now();
  return { success: true };
}

/**
 * Ferme la fenêtre Nope et résout l'action selon le résultat de la chaîne.
 * Retourne :
 *   { resolved: true, action: actionDescriptor }     → action exécutée normalement
 *   { resolved: false, canceled: true }              → action annulée
 */
export function closeNopeWindow(state) {
  const window = state.nopeWindow;
  if (!window) return { resolved: false, canceled: false };

  const chainLen = window.nopeChain.length;
  // Chaîne paire ou nulle → action passe ; impaire → annulée
  const isCanceled = chainLen % 2 === 1;

  state.nopeWindow = null;

  return {
    resolved: !isCanceled,
    canceled: isCanceled,
    chainLength: chainLen,
    action: window.actionDescriptor,
  };
}

export function endTurn(state, playerUid) {
  if (state.turn.activePlayerUid !== playerUid) {
    return { success: false, error: 'Pas ton tour' };
  }

  const player = state.players[playerUid];

  // ⚠️ Gestion du danger -100% : si le joueur termine son propre tour
  // toujours en danger, et que ça fait au moins un tour complet → éliminé.
  let dangerEliminated = false;
  if (player && !player.isGhosted && player.profile.isInDanger) {
    if (player.profile.dangerStartedAtTurn === null) {
      // Premier endTurn en danger → on marque maintenant
      player.profile.dangerStartedAtTurn = state.turn.turnNumber;
    } else {
      // Déjà en danger depuis un tour précédent : on élimine
      dangerEliminated = true;
      player.isGhosted = true;
      player.profile.activeFlags = [];
      state.deck.ghostedRemaining = Math.max(0, state.deck.ghostedRemaining - 0); // pas un Ghosté de pioche
    }
  }

  // Reset des trackers du tour
  state.turn.crushPlayedThisTurn = [];
  state.turn.greenFlagsPlayedThisTurn = 0;
  state.turn.redFlagsPlayedThisTurn = 0;
  state.turn.mustEndTurn = false;
  state.turn.disconnectedDuringTurnUid = null;
  state.turn.disconnectedAt = null;
  state.pendingCrushCombo = null;

  // Si éliminé par danger, on n'a plus à piocher, on avance directement
  if (dangerEliminated) {
    const advanceResult = advanceToNextTurn(state);
    let traitReveal = null;
    if (advanceResult?.newRound) {
      traitReveal = revealTraitForCurrentRound(state);
    }
    const endCheck = checkGameEnd(state);
    if (endCheck) {
      state.status = GAME_STATUS.ENDED;
      state.winner = endCheck.playerUid;
      state.endedAt = Date.now();
    }
    return {
      success: true,
      dangerEliminated: true,
      advanceResult,
      traitReveal,
      gameEnded: endCheck || null,
    };
  }

  // 1. Pioche obligatoire (sauf si SKIP a été joué ce tour)
  let drawResult = null;
  const shouldSkipDraw = state.turn.skipDrawForUid === playerUid;
  if (shouldSkipDraw) {
    drawResult = { success: true, drawnCards: [], skipped: true };
    state.turn.skipDrawForUid = null;
  } else {
    drawResult = drawEndOfTurn(state, playerUid);
    if (drawResult.drawnGhosted) {
      return { success: true, mustHandleGhosted: true, drawResult };
    }
  }

  // 4. Vérifie fin de partie — AVANT d'avancer pour que activePlayerUid soit encore correct
  // checkDateImminentSurvival compare activePlayerUid === dateImminent.playerUid
  const endCheckBeforeAdvance = checkGameEnd(state);
  if (endCheckBeforeAdvance) {
    state.status = GAME_STATUS.ENDED;
    state.winner = endCheckBeforeAdvance.playerUid;
    state.endedAt = Date.now();
    return {
      success: true,
      drawResult,
      advanceResult: null,
      traitReveal: null,
      gameEnded: endCheckBeforeAdvance,
    };
  }

  // 5. Avance au joueur suivant
  const advanceResult = advanceToNextTurn(state);

  // 6. Si nouveau tour de table → révèle un trait
  let traitReveal = null;
  if (advanceResult?.newRound) {
    traitReveal = revealTraitForCurrentRound(state);
  }

  // 7. Dernier check post-avance (survivant unique)
  const endCheck = checkGameEnd(state);
  if (endCheck) {
    state.status = GAME_STATUS.ENDED;
    state.winner = endCheck.playerUid;
    state.endedAt = Date.now();
    return {
      success: true,
      drawResult,
      advanceResult,
      traitReveal,
      gameEnded: endCheck,
    };
  }

  return {
    success: true,
    drawResult,
    advanceResult,
    traitReveal,
  };
}

// ===== Helpers =====

function computeNextPlayerUid(state, fromUid) {
  const players = Object.values(state.players).sort((a, b) => a.turnOrder - b.turnOrder);
  const idx = players.findIndex(p => p.uid === fromUid);
  let next = (idx + 1) % players.length;
  let safety = 0;
  while (players[next].isGhosted && safety < players.length) {
    next = (next + 1) % players.length;
    safety++;
  }
  return players[next].uid;
}

// ===== Multijoueur : Présence & Reconnexion =====

/**
 * Marque un joueur comme déconnecté.
 *
 * ✅ RÈGLE : Si le joueur actif se déconnecte pendant son tour :
 *   - On sauvegarde son UID dans `turn.disconnectedDuringTurnUid`
 *   - Son tour est interrompu (avance au joueur suivant)
 *   - Quand il revient, `handlePlayerReconnect()` lui redonne son tour complet.
 *
 * ✅ RÈGLE : Si un joueur non-actif se déconnecte :
 *   - Marqué `isConnected: false`
 *   - Skippé dans `advanceToNextTurn` tant qu'il est déco
 *   - Revient naturellement quand il reconnecte
 *
 * @returns {{ wasActive, advanceNeeded }} wasActive=true si c'était son tour
 */
export function handlePlayerDisconnect(state, playerUid) {
  const player = state.players[playerUid];
  if (!player || player.isGhosted) return { wasActive: false, advanceNeeded: false };

  player.isConnected = false;

  const wasActive = state.turn.activePlayerUid === playerUid;
  if (wasActive) {
    // Sauvegarde le contexte du tour interrompu
    state.turn.disconnectedDuringTurnUid = playerUid;
    state.turn.disconnectedAt = Date.now();
  }

  return { wasActive, advanceNeeded: wasActive };
}

/**
 * Gère la reconnexion d'un joueur.
 *
 * ✅ RÈGLE : Si le joueur revient alors que c'était son tour interrompu →
 *   son tour est restauré (compteurs remis, mustEndTurn = false).
 *
 * ✅ RÈGLE : Sinon → il reprend sa place normale dans la rotation.
 *
 * @returns {{ turnRestored }} turnRestored=true si son tour est remis
 */
export function handlePlayerReconnect(state, playerUid) {
  const player = state.players[playerUid];
  if (!player) return { turnRestored: false };

  player.isConnected = true;

  // Restauration du tour si c'était lui le joueur actif déconnecté
  if (state.turn.disconnectedDuringTurnUid === playerUid) {
    state.turn.activePlayerUid = playerUid;
    // Reset des compteurs de tour (tour complet frais)
    state.turn.greenFlagsPlayedThisTurn = 0;
    state.turn.redFlagsPlayedThisTurn = 0;
    state.turn.mustEndTurn = false;
    state.turn.turnStartedAt = Date.now();
    state.turn.disconnectedDuringTurnUid = null;
    state.turn.disconnectedAt = null;
    return { turnRestored: true };
  }

  return { turnRestored: false };
}

/**
 * Kick un joueur déconnecté depuis trop longtemps.
 * Utilisé par la Cloud Function de timeout.
 *
 * @returns {{ kicked, advanceNeeded }}
 */
export function kickDisconnectedPlayer(state, playerUid) {
  const player = state.players[playerUid];
  if (!player || player.isConnected) return { kicked: false };

  // Ghost le joueur (éliminé par déconnexion)
  player.isGhosted = true;
  player.isConnected = false;

  const wasActive = state.turn.disconnectedDuringTurnUid === playerUid;
  if (wasActive) {
    state.turn.disconnectedDuringTurnUid = null;
    state.turn.disconnectedAt = null;
  }

  const endCheck = checkGameEnd(state);
  if (endCheck) {
    state.status = GAME_STATUS.ENDED;
    state.winner = endCheck.playerUid;
    state.endedAt = Date.now();
  }

  return { kicked: true, advanceNeeded: wasActive, gameEnded: endCheck || null };
}

