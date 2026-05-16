/**
 * RedFlag — Turn Manager
 *
 * Gère l'ordre des tours, les passages, les révélations de traits du Crush
 * tour par tour, et les états spéciaux (stun, Date Imminent).
 */

import { GAME_CONFIG } from '../config/game-constants.js';
import {
  getAllPrincipalTraits,
  getSubtraitsOf,
  getTrait,
  TRAIT_TYPES,
} from '../data/traits-catalog.js';
import { randomFrom } from '../utils/helpers.js';

/**
 * Calcule l'index du joueur actif suivant.
 * Saute les joueurs Ghostés.
 */
export function getNextPlayerIndex(currentIndex, players) {
  const playerList = Object.values(players).sort((a, b) => a.turnOrder - b.turnOrder);
  if (playerList.length === 0) return null;

  let nextIndex = (currentIndex + 1) % playerList.length;
  let safety = 0;

  while (playerList[nextIndex].isGhosted && safety < playerList.length) {
    nextIndex = (nextIndex + 1) % playerList.length;
    safety++;
  }

  return nextIndex;
}

/**
 * Récupère l'UID du joueur dont c'est le tour.
 */
export function getActivePlayerUid(gameState) {
  return gameState.turn?.activePlayerUid || null;
}

/**
 * Récupère l'UID du joueur SUIVANT (utile pour les Red Flags "joueur suivant").
 */
export function getNextPlayerUid(gameState) {
  const players = gameState.players;
  const activeUid = gameState.turn.activePlayerUid;
  const playerList = Object.values(players).sort((a, b) => a.turnOrder - b.turnOrder);
  const currentIndex = playerList.findIndex(p => p.uid === activeUid);
  if (currentIndex === -1) return null;

  const nextIndex = getNextPlayerIndex(currentIndex, players);
  return nextIndex !== null ? playerList[nextIndex].uid : null;
}

/**
 * Avance au joueur suivant. Gère :
 * - Les joueurs stunnés (qui sautent leur tour)
 * - Les joueurs déconnectés (skippés en multijoueur, reconnexion = retour naturel)
 * - L'incrémentation du tour de table
 */
export function advanceToNextTurn(gameState) {
  const playerList = Object.values(gameState.players).sort((a, b) => a.turnOrder - b.turnOrder);
  const currentUid = gameState.turn.activePlayerUid;
  const currentIndex = playerList.findIndex(p => p.uid === currentUid);

  let nextIndex = getNextPlayerIndex(currentIndex, gameState.players);
  if (nextIndex === null) return null;

  let nextPlayer = playerList[nextIndex];
  let safety = 0;

  // Saute stunnés ET déconnectés (en mode multijoueur, isConnected peut être false)
  // Anti-softlock : si tous les joueurs restants sont déco, on garde quand même le prochain
  const allNonGhosted = playerList.filter(p => !p.isGhosted);
  const allDisconnected = allNonGhosted.every(p => p.isConnected === false && !p.isBot);

  while (safety < playerList.length && !allDisconnected) {
    const isStunnedPlayer = gameState.turn.stunnedPlayers?.includes(nextPlayer.uid);
    const isDisconnected = nextPlayer.isConnected === false && !nextPlayer.isBot;

    if (!isStunnedPlayer && !isDisconnected) break;

    if (isStunnedPlayer) {
      gameState.turn.stunnedPlayers = gameState.turn.stunnedPlayers.filter(u => u !== nextPlayer.uid);
    }

    nextIndex = getNextPlayerIndex(nextIndex, gameState.players);
    if (nextIndex === null) return null;
    nextPlayer = playerList[nextIndex];
    safety++;
  }

  // A-t-on bouclé un tour de table complet (revenu au "premier" joueur non Ghosté) ?
  const firstAliveIdx = playerList.findIndex(p => !p.isGhosted);
  const isNewRound = nextIndex === firstAliveIdx;

  gameState.turn.activePlayerUid = nextPlayer.uid;
  gameState.turn.turnNumber = (gameState.turn.turnNumber || 0) + 1;
  gameState.turn.turnStartedAt = Date.now();
  gameState.turn.actionsThisTurn = 0;

  // ✅ RÈGLE : limite de Red Flags sur le plateau.
  // Si le prochain joueur a ≥ MAX_RED_FLAGS_ON_BOARD red flags, il est éliminé.
  const nextPlayerObj = gameState.players[nextPlayer.uid];
  if (nextPlayerObj && !nextPlayerObj.isGhosted) {
    const redFlagCount = (nextPlayerObj.profile?.activeFlags || [])
      .filter(f => f.type === 'red').length;
    const maxRedFlags = gameState.config?.maxRedFlags ?? GAME_CONFIG.MAX_RED_FLAGS_ON_BOARD;
    if (redFlagCount >= maxRedFlags) {
      nextPlayerObj.isGhosted = true;
      nextPlayerObj.profile.activeFlags = [];
      gameState.turn.redFlagElimination = nextPlayer.uid;
    }
  }

  // Reset lastAction au changement de tour, mais garde l'historique
  if (gameState.lastAction) {
    if (!gameState.actionHistory) gameState.actionHistory = [];
    gameState.actionHistory.unshift(gameState.lastAction);
    gameState.actionHistory = gameState.actionHistory.slice(0, 5); // garde les 5 dernières
    gameState.lastAction = null;
  }

  // Décale les immunités (un tour est passé)
  if (gameState.turn.immunityNextTurn?.length) {
    gameState.turn.activeImmunities = [...gameState.turn.immunityNextTurn];
    gameState.turn.immunityNextTurn = [];
  } else {
    gameState.turn.activeImmunities = [];
  }

  if (isNewRound) {
    gameState.currentRound = (gameState.currentRound || 1) + 1;
    return { newRound: true, newRoundNumber: gameState.currentRound };
  }

  return { newRound: false };
}

/**
 * Sélectionne un nouveau trait à révéler pour ce tour de table.
 *
 * Logique :
 * - Tour 1 : Trait Principal #1
 * - Tour 2 : Sous-Trait du Principal #1
 * - Tour 3 : Trait Principal #2
 * - Tour 4 : Sous-Trait du Principal #2
 * - Tour 5 : Trait Principal #3
 * - Tour 6 : Sous-Trait du Principal #3
 * - Tour 7+ : OVERTIME (rien à révéler, le système ajoute des Ghostés)
 */
export function selectTraitToReveal(gameState) {
  const round = gameState.currentRound || 1;
  if (round > GAME_CONFIG.MAX_TRAITS_BEFORE_OVERTIME) {
    return null; // OVERTIME — pas de nouveau trait
  }

  const revealed = gameState.crush?.revealedTraits || [];
  const isPrincipalRound = round % 2 === 1; // Tours 1, 3, 5

  if (isPrincipalRound) {
    // On tire un Principal aléatoire qui n'est pas déjà révélé
    const allPrincipals = getAllPrincipalTraits();
    const revealedPrincipalIds = new Set(
      revealed.filter(t => t.type === TRAIT_TYPES.PRINCIPAL).map(t => t.traitId)
    );
    const available = allPrincipals.filter(t => !revealedPrincipalIds.has(t.id));

    if (available.length === 0) return null;
    const chosen = randomFrom(available);

    return {
      traitId: chosen.id,
      type: TRAIT_TYPES.PRINCIPAL,
      revealedAtRound: round,
      isActive: true,
    };
  }

  // Sous-trait : du dernier Principal révélé
  const lastPrincipal = [...revealed]
    .reverse()
    .find(t => t.type === TRAIT_TYPES.PRINCIPAL);
  if (!lastPrincipal) return null;

  const revealedSubIds = new Set(
    revealed.filter(t => t.type === TRAIT_TYPES.SUBTRAIT).map(t => t.traitId)
  );
  const candidates = getSubtraitsOf(lastPrincipal.traitId).filter(s => !revealedSubIds.has(s.id));
  if (candidates.length === 0) return null;

  const chosen = randomFrom(candidates);
  return {
    traitId: chosen.id,
    type: TRAIT_TYPES.SUBTRAIT,
    parentTraitId: lastPrincipal.traitId,
    revealedAtRound: round,
    isActive: true,
  };
}

/**
 * Vérifie si un joueur est stunné (passe son tour).
 */
export function isStunned(gameState, uid) {
  return gameState.turn.stunnedPlayers?.includes(uid) || false;
}

/**
 * Vérifie si un joueur a une immunité active.
 */
export function hasImmunity(gameState, uid) {
  return gameState.turn.activeImmunities?.includes(uid) || false;
}
