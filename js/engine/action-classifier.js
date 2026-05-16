/**
 * RedFlag — Action Classifier
 *
 * Détermine si une action ouvre une fenêtre Nope (5s + chaîne).
 *
 * Selon le cahier des charges :
 * - Pioche envoyée à un autre joueur (carte 📲) → NOPE
 * - Carte Crush combo qui cible un autre joueur (vol/demande) → NOPE
 * - Toute action attaquante (Red Flag, Action offensive) → NOPE
 * - Green Flag posé (peu importe la cible) → NOPE
 * - Mélanger / Faveur / Divination / Changer / Retournement → pas NOPE (ce sont des effets sur soi/deck)
 * - Bouclier (face à Ghosté) → pas NOPE
 * - Skip / Super Skip → pas NOPE
 *
 * On classifie via le card.type et action effect, pas par carte.
 */

import { CARD_TYPES, ACTION_EFFECTS } from '../config/game-constants.js';
import { getCard } from '../data/cards-catalog.js';

/**
 * Détermine si une carte jouée doit ouvrir une fenêtre Nope.
 *
 * @param {object} card
 * @param {object} options - { targetUid, sourceUid }
 * @returns {boolean}
 */
export function isNopeable(card, options = {}) {
  if (!card) return false;

  // Green Flag et Red Flag : toujours nopeable
  if (card.type === CARD_TYPES.GREEN_FLAG) return true;
  if (card.type === CARD_TYPES.RED_FLAG) return true;

  // Conditional → c'est un flag final, donc nopeable
  if (card.type === CARD_TYPES.CONDITIONAL) return true;

  // Pioche → nopeable (chaîne incluse)
  if (card.type === CARD_TYPES.DRAW) return true;

  // Crush combo → nopeable car cible un autre joueur
  if (card.type === CARD_TYPES.CRUSH) return true;

  // Actions : selon l'effet
  if (card.type === CARD_TYPES.ACTION) {
    const offensiveEffects = [
      ACTION_EFFECTS.STEAL_GREEN_FLAG,
      ACTION_EFFECTS.STEAL_AND_FORCE_DRAW,
      ACTION_EFFECTS.STEAL_AND_PLACE_RED,
      ACTION_EFFECTS.STUN_NEXT_TURN,
      ACTION_EFFECTS.STUN_AND_DAMAGE,
      ACTION_EFFECTS.STUN_TWO_TARGETS,
      ACTION_EFFECTS.PEEK_HAND,
      ACTION_EFFECTS.SWAP_HANDS,
      ACTION_EFFECTS.FAVOR,           // Demander une carte = offensif
      ACTION_EFFECTS.TABLE_RASE,      // Si cible autre que soi
    ];
    if (offensiveEffects.includes(card.actionEffect)) {
      // Pour TABLE_RASE : nopeable seulement si cible n'est pas soi
      if (card.actionEffect === ACTION_EFFECTS.TABLE_RASE) {
        return options.targetUid && options.targetUid !== options.sourceUid;
      }
      return true;
    }
  }

  // Sinon : pas de Nope window (auto-soin, esquive, modification deck pour soi, etc.)
  return false;
}

/**
 * Construit un descripteur d'action pour la fenêtre Nope.
 */
export function buildActionDescriptor(playerUid, cardCode, options = {}) {
  const card = getCard(cardCode);
  return {
    actionId: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'play_card',
    sourcePlayerUid: playerUid,
    cardCode,
    cardName: card?.name || '?',
    targetUid: options.targetUid || null,
    isCrushCombo: !!options.crushCombo,
    crushComboCards: options.crushCombo || null,
    options,
  };
}
