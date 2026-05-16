/**
 * RedFlag — Deck Manager
 *
 * Gère la construction du deck, la pioche, la défausse, et l'insertion
 * des cartes "Tu es Ghosté".
 */

import { CARDS_CATALOG } from '../data/cards-catalog.js';
import { CARD_TYPES, GAME_CONFIG } from '../config/game-constants.js';
import { shuffle, shuffled, uid } from '../utils/helpers.js';

/**
 * Construit le deck initial avec une taille ET des proportions équilibrées.
 *
 * Catalogue complet :
 *   26 Green Flag · 25 Red Flag · 22 Action · 15 Conditional
 *   10 Draw · 6 Crush · 5 Shield (distribué séparément) · 2 Skip · 1 Nope
 *
 * Problème sans filtre : 51 flags sur 112 cartes = 45% → parties trop agressives.
 *
 * Ratios cibles (% du deck) :
 *   Green Flag   : 15 %   (séduire sans spammer)
 *   Red Flag     : 12 %   (punir sans écraser)
 *   Action       : 25 %   (variété, moteur du jeu)
 *   Conditional  : 20 %   (stratégie, traits crush)
 *   Draw         : 13 %   (pression, chaînes)
 *   Crush        : 10 %   (combos fréquents mais pas omniprésents)
 *   Skip         :  3 %   (rares, précieux)
 *   Nope         :  2 %   (très rares)
 *
 * Taille totale : CARDS_PER_PLAYER (15) × nombre de joueurs.
 * Minimum 48 cartes, maximum = catalogue complet.
 *
 * @param {number} numPlayers
 */
export function buildInitialDeck(numPlayers = 4) {
  const targetSize = Math.max(48, Math.min(numPlayers * GAME_CONFIG.CARDS_PER_PLAYER, 110));

  // Ratios par type (doivent sommer à 1.0)
  const ratios = {
    [CARD_TYPES.GREEN_FLAG]:   0.15,
    [CARD_TYPES.RED_FLAG]:     0.12,
    [CARD_TYPES.ACTION]:       0.25,
    [CARD_TYPES.CONDITIONAL]:  0.20,
    [CARD_TYPES.DRAW]:         0.13,
    [CARD_TYPES.CRUSH]:        0.10,
    [CARD_TYPES.SKIP]:         0.03,
    [CARD_TYPES.NOPE]:         0.02,
  };

  // Pool par type (exclut Bouclier et Ghosté — distribués autrement)
  const poolByType = {};
  for (const card of CARDS_CATALOG) {
    if (card.type === CARD_TYPES.SHIELD)  continue;
    if (card.type === CARD_TYPES.GHOSTED) continue;
    if (!poolByType[card.type]) poolByType[card.type] = [];
    poolByType[card.type].push(card.code);
  }

  const deck = [];

  for (const [type, ratio] of Object.entries(ratios)) {
    const pool = poolByType[type] || [];
    if (pool.length === 0) continue;

    const wanted = Math.round(targetSize * ratio);
    const shuffledPool = shuffled(pool);

    // Si le pool est plus petit que le quota → on peut dupliquer (wrap around)
    // pour ne pas manquer de cartes d'un type rare (ex: Skip x2 = 4 copies)
    let added = 0;
    while (added < wanted) {
      const card = shuffledPool[added % shuffledPool.length];
      deck.push(card);
      added++;
    }
  }

  // Mélange final et trim à targetSize si légère variation d'arrondi
  return shuffled(deck).slice(0, targetSize);
}

/**
 * Distribue les mains de départ.
 * Chaque joueur reçoit 1 bouclier + 6 cartes piochées.
 * Retourne :
 * - hands: { uid: [codes] }
 * - remainingDeck: [codes] mélangé, prêt à servir de pioche
 */
export function dealStartingHands(playerUids) {
  const deck = shuffled(buildInitialDeck(playerUids.length));
  const hands = {};

  // Récupère les boucliers disponibles dans le catalogue
  const shieldCodes = CARDS_CATALOG
    .filter(c => c.type === CARD_TYPES.SHIELD)
    .map(c => c.code);

  if (shieldCodes.length < playerUids.length) {
    console.warn(`Pas assez de boucliers (${shieldCodes.length}) pour ${playerUids.length} joueurs.`);
  }

  // 1 bouclier par joueur (pris dans la pile des boucliers)
  const shieldsToGive = shuffled(shieldCodes);
  for (let i = 0; i < playerUids.length; i++) {
    hands[playerUids[i]] = [shieldsToGive[i % shieldsToGive.length]];
  }

  // Puis 6 cartes piochées du deck
  for (let i = 0; i < GAME_CONFIG.STARTING_HAND_SIZE; i++) {
    for (const playerUid of playerUids) {
      const card = deck.pop();
      if (card) hands[playerUid].push(card);
    }
  }

  // ✅ FIX : mélange chaque main pour que le bouclier ne soit pas toujours en position 0
  for (const uid of playerUids) {
    hands[uid] = shuffled(hands[uid]);
  }

  return {
    hands,
    remainingDeck: deck,
  };
}

/**
 * Insère les cartes "Tu es Ghosté" dans le deck après distribution.
 * Pour N joueurs → N-1 cartes Ghosté.
 */
export function insertGhostedCards(deck, numPlayers) {
  const ghostedCount = Math.max(1, numPlayers + GAME_CONFIG.GHOSTED_CARDS_OFFSET);
  const newDeck = [...deck];

  for (let i = 0; i < ghostedCount; i++) {
    newDeck.push('GHOSTED');
  }

  return {
    deck: shuffle(newDeck),
    ghostedCount,
  };
}

/**
 * Pioche N cartes du dessus du deck.
 * Retourne :
 * - drawnCards: [codes] piochés (peut contenir 'GHOSTED')
 * - remainingDeck: [codes] restants
 */
export function drawCards(deck, n = 1) {
  if (deck.length < n) {
    // Edge case : deck vide → on ne pioche que ce qu'il reste
    n = deck.length;
  }

  const drawnCards = deck.slice(-n).reverse(); // pop dans l'ordre
  const remainingDeck = deck.slice(0, -n);

  return { drawnCards, remainingDeck };
}

/**
 * Défausse une carte (l'ajoute à la pile de défausse).
 * On garde un historique simple pour l'animation et l'affichage.
 */
export function discardCard(discardPile, cardCode, playedBy = null) {
  return [
    ...discardPile,
    {
      code: cardCode,
      playedBy,
      playedAt: Date.now(),
    },
  ];
}

/**
 * Retire une carte spécifique de la pioche (utile pour le bouclier qui replace
 * une Ghosté à une position précise).
 * Retourne null si la carte n'est pas trouvée.
 */
export function removeCardFromDeck(deck, cardCode) {
  const index = deck.lastIndexOf(cardCode);
  if (index === -1) return null;
  return [...deck.slice(0, index), ...deck.slice(index + 1)];
}

/**
 * Insère une carte Ghosté à une position précise dans le deck.
 * Position 0 = au sommet (= sera la prochaine piochée).
 * Position deck.length = au fond.
 */
export function insertGhostedAtPosition(deck, position) {
  const safePos = Math.max(0, Math.min(position, deck.length));
  // Note : le sommet de la pioche correspond à la fin du tableau (on pop pour piocher)
  // Donc position 0 = à la fin du tableau
  const insertIndex = deck.length - safePos;
  return [
    ...deck.slice(0, insertIndex),
    'GHOSTED',
    ...deck.slice(insertIndex),
  ];
}

/**
 * Mélange complètement la pioche (carte Catfish).
 */
export function shuffleDeck(deck) {
  return shuffled(deck);
}

/**
 * Compte le nombre de cartes Ghosté restantes dans la pioche.
 */
export function countGhostedInDeck(deck) {
  return deck.filter(c => c === 'GHOSTED').length;
}

/**
 * Regarde les N prochaines cartes du sommet (pour la carte Stalker).
 * Ne modifie pas le deck.
 */
export function peekTop(deck, n = 3) {
  return deck.slice(-n).reverse();
}

/**
 * Réordonne les N premières cartes du sommet (après un peek).
 * `newOrder` est un tableau de codes dans l'ordre voulu (top → bottom).
 */
export function reorderTop(deck, newOrder) {
  const remaining = deck.slice(0, -newOrder.length);
  return [...remaining, ...newOrder.reverse()];
}
