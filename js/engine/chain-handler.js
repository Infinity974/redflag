/**
 * RedFlag — Chain Handler
 *
 * Gère le système de chaîne de pioche : quand un joueur reçoit une carte 📲,
 * il peut contre-attaquer avec sa propre carte 📲 et le total se cumule
 * avant d'arriver au joueur suivant.
 */

import { getCard } from '../data/cards-catalog.js';
import { CARD_TYPES, GAME_CONFIG } from '../config/game-constants.js';
import { getNextPlayerUid } from './turn-manager.js';
import { uid } from '../utils/helpers.js';

/**
 * Démarre une nouvelle chaîne de pioche.
 * Appelé quand un joueur joue sa première carte 📲.
 */
export function startChain(gameState, originUid, cardCode, targetUid) {
  const card = getCard(cardCode);
  if (!card || card.type !== CARD_TYPES.DRAW) {
    return { success: false, error: 'Pas une carte pioche' };
  }

  gameState.activeChain = {
    id: uid('chain'),
    totalToDraw: card.chainValue,
    originPlayerUid: originUid,
    currentTargetUid: targetUid,
    chainHistory: [
      {
        playerUid: originUid,
        cardCode,
        cardName: card.name,
        valueAdded: card.chainValue,
        timestamp: Date.now(),
      },
    ],
    expiresAt: Date.now() + GAME_CONFIG.CHAIN_RESPONSE_TIMEOUT_MS,
    selfPenalty: card.selfPenalty || 0,
  };

  // Si c'est PC-04 "Storm" → tout le monde pioche
  if (card.target === 'all') {
    gameState.activeChain.targetType = 'all';
  }

  return {
    success: true,
    chain: gameState.activeChain,
  };
}

/**
 * Le joueur ciblé par une chaîne ajoute sa propre carte 📲 pour la passer
 * au joueur suivant avec le compteur cumulé.
 */
export function addToChain(gameState, playerUid, cardCode) {
  const chain = gameState.activeChain;
  if (!chain) {
    return { success: false, error: 'Pas de chaîne active' };
  }

  if (chain.currentTargetUid !== playerUid) {
    return { success: false, error: "Ce n'est pas à toi de répondre" };
  }

  const card = getCard(cardCode);
  if (!card || card.type !== CARD_TYPES.DRAW) {
    return { success: false, error: 'Pas une carte pioche' };
  }

  // Cumule le compteur
  chain.totalToDraw += card.chainValue;
  chain.chainHistory.push({
    playerUid,
    cardCode,
    cardName: card.name,
    valueAdded: card.chainValue,
    timestamp: Date.now(),
  });

  // Détermine le nouveau target : le joueur suivant après le contre-attaquant
  const playerList = Object.values(gameState.players)
    .sort((a, b) => a.turnOrder - b.turnOrder);
  const currentIdx = playerList.findIndex(p => p.uid === playerUid);

  let nextIdx = (currentIdx + 1) % playerList.length;
  let safety = 0;
  while (playerList[nextIdx].isGhosted && safety < playerList.length) {
    nextIdx = (nextIdx + 1) % playerList.length;
    safety++;
  }

  chain.currentTargetUid = playerList[nextIdx].uid;
  chain.expiresAt = Date.now() + GAME_CONFIG.CHAIN_RESPONSE_TIMEOUT_MS;

  return {
    success: true,
    chain,
    newTargetUid: chain.currentTargetUid,
  };
}

/**
 * Résout la chaîne : le joueur ciblé subit toute la pioche cumulée.
 * Retourne la liste des cartes piochées (pour révéler une à une).
 *
 * IMPORTANT : la pioche se fait carte par carte. Si une Ghosté apparaît
 * au milieu, le joueur doit la gérer immédiatement avant de continuer.
 */
export function resolveChain(gameState, playerUid) {
  const chain = gameState.activeChain;
  if (!chain) return { success: false };

  if (chain.currentTargetUid !== playerUid) {
    return { success: false, error: 'Pas le bon joueur' };
  }

  const totalToDraw = chain.totalToDraw;
  const player = gameState.players[playerUid];
  const isAllTarget = chain.targetType === 'all';
  const selfPenalty = chain.selfPenalty || 0;
  const originPlayerUid = chain.originPlayerUid;

  const result = {
    success: true,
    playerUid,
    totalToDraw,
    chainHistory: [...chain.chainHistory],
    isAllTarget,
    selfPenalty,
    originPlayerUid,
  };

  gameState.activeChain = null;

  return result;
}

/**
 * Vérifie si un joueur peut contrer une chaîne (a-t-il une carte 📲 en main ?)
 */
export function canCounterChain(player) {
  if (!player || !player.hand) return false;
  return player.hand.some(code => {
    const card = getCard(code);
    return card && card.type === CARD_TYPES.DRAW;
  });
}

/**
 * Annule une chaîne (appelé en cas de timeout ou de fin de partie).
 */
export function cancelChain(gameState) {
  gameState.activeChain = null;
}
