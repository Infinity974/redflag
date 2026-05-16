/**
 * RedFlag — Card Renderer V3
 *
 * Génère le HTML d'une carte avec :
 * - Tags placés dans un bandeau bas DÉDIÉ (jamais sur le texte)
 * - Hiérarchie visuelle claire : badge type, valeur grosse, titre, effet, tags
 * - Joker visible (data-joker)
 * - Lock visuel (Bouclier hors-Ghosté)
 * - Combo selected (highlighted pendant la sélection Crush)
 * - data-hand-index pour drag & drop
 */

import { getCard } from '../data/cards-catalog.js';
import { CARD_TYPES } from '../config/game-constants.js';
import { detectCriticalHit, evaluateConditionalCard } from '../engine/tag-matcher.js';

function getCardTypeClass(card) {
  switch (card.type) {
    case CARD_TYPES.GREEN_FLAG: return 'game-card--green';
    case CARD_TYPES.RED_FLAG: return 'game-card--red';
    case CARD_TYPES.CONDITIONAL: return 'game-card--conditional';
    case CARD_TYPES.ACTION: return 'game-card--action';
    case CARD_TYPES.SHIELD: return 'game-card--shield';
    case CARD_TYPES.DRAW: return 'game-card--draw';
    case CARD_TYPES.CRUSH: return 'game-card--crush';
    case CARD_TYPES.NOPE: return 'game-card--nope';
    case CARD_TYPES.SKIP: return 'game-card--skip';
    default: return '';
  }
}

function getTypeBadgeLabel(card) {
  switch (card.type) {
    case CARD_TYPES.GREEN_FLAG: return 'GREEN';
    case CARD_TYPES.RED_FLAG: return 'RED';
    case CARD_TYPES.CONDITIONAL:
      return card.conditional?.requiresAnyTag?.[0]
        ? `SI ${card.conditional.requiresAnyTag[0].replace('#', '').toUpperCase()}`
        : 'SI ?';
    case CARD_TYPES.ACTION: return getActionBadge(card);
    case CARD_TYPES.SHIELD: return 'BOUCLIER';
    case CARD_TYPES.DRAW: return `+${card.chainValue} PIOCHE`;
    case CARD_TYPES.CRUSH: return card.isJoker ? 'JOKER' : 'CRUSH';
    case CARD_TYPES.NOPE: return 'NOPE';
    case CARD_TYPES.SKIP: return card.code?.startsWith('SUPER') ? 'SUPER PASS' : 'PASS';
    default: return '';
  }
}

function getActionBadge(card) {
  const map = {
    purge_red_flags: 'PURGE',
    purge_and_boost: 'PURGE+',
    purge_and_immunity: 'PURGE++',
    steal_green_flag: 'VOL',
    steal_and_force_draw: 'VOL+',
    steal_and_place_red: 'VOL+RED',
    stun_next_turn: 'STUN',
    stun_and_damage: 'STUN+',
    stun_two_targets: 'STUN×2',
    peek_deck: 'VISION',
    peek_hand: 'FOUILLE',
    skip_draw: 'ESQUIVE',
    super_skip: 'SUPER PASS',
    block: 'BLOC',
    shuffle_deck: 'CHAOS',
    swap_hands: 'SWAP',
    nope_last: 'NOPE',
    transform_flag: 'REFRAME',
  };
  return map[card.actionEffect] || 'ACTION';
}

function formatValue(card, effectiveValue = null) {
  const v = effectiveValue ?? card.value;
  if (!v) return '';
  return v > 0 ? `+${v}%` : `${v}%`;
}

/**
 * Génère le HTML d'une carte.
 *
 * @param {string} cardCode
 * @param {object} options
 * @param {Array} options.activeTraits
 * @param {boolean} options.canCounter
 * @param {boolean} options.inHand
 * @param {boolean} options.selected
 * @param {boolean} options.isLocked - Carte non-jouable (Bouclier hors-Ghosté)
 * @param {boolean} options.isComboSelected - Sélectionnée pour combo Crush
 * @param {number} options.handIndex - Index dans la main (drag&drop)
 */
export function renderCard(cardCode, options = {}) {
  const card = getCard(cardCode);
  if (!card) {
    return '<div class="game-card game-card--unknown">?</div>';
  }

  const {
    activeTraits = [],
    canCounter = false,
    inHand = false,
    selected = false,
    isLocked = false,
    isComboSelected = false,
    handIndex = null,
  } = options;

  // Détection des opportunités
  const crit = detectCriticalHit(card, activeTraits);
  const isCriticalAvailable = crit.isCritical;
  const isDoubleCritAvailable = crit.isDoubleCritical;

  let isConditionalActivable = false;
  let isConditionalUseless = false;
  let conditionalValue = card.value;

  if (card.type === CARD_TYPES.CONDITIONAL) {
    const evaluation = evaluateConditionalCard(card, activeTraits);
    if (evaluation.canPlay) {
      isConditionalActivable = true;
      conditionalValue = evaluation.value;
    } else {
      isConditionalUseless = true;
    }
  }

  // Classes CSS
  const classes = ['game-card', getCardTypeClass(card)];
  if (inHand) classes.push('game-card--in-hand');
  if (canCounter) classes.push('game-card--counter-available');
  if (isLocked) classes.push('game-card--locked');
  if (isConditionalActivable) classes.push('game-card--activable');
  if (isDoubleCritAvailable) classes.push('game-card--double-crit', 'game-card--activable');
  else if (isCriticalAvailable && card.type !== CARD_TYPES.CONDITIONAL) classes.push('game-card--activable');
  if (isConditionalUseless) classes.push('game-card--useless');

  // Hint au-dessus
  let hintHtml = '';
  if (isComboSelected) {
    hintHtml = `<div class="game-card__combo-hint">💕 COMBO</div>`;
  } else if (canCounter) {
    hintHtml = `<div class="game-card__counter-hint">▲ CONTRE</div>`;
  } else if (isDoubleCritAvailable) {
    hintHtml = `<div class="game-card__activable-hint">✦✦ DOUBLE</div>`;
  } else if (isCriticalAvailable && (card.type === CARD_TYPES.GREEN_FLAG || card.type === CARD_TYPES.RED_FLAG)) {
    hintHtml = `<div class="game-card__activable-hint">✦ CRITIQUE</div>`;
  } else if (isConditionalActivable) {
    hintHtml = `<div class="game-card__activable-hint">✦ ACTIVABLE</div>`;
  }

  const title = card.name.toUpperCase();

  let valueHtml = '';
  if (card.value || conditionalValue) {
    const v = isConditionalActivable ? conditionalValue : card.value;
    if (v) valueHtml = `<span class="game-card__value">${formatValue(card, v)}</span>`;
  }

  const description = card.description || '';

  // Tags : 2 max pour ne pas déborder
  const visibleTags = (card.displayedTags || []).slice(0, 3);
  const tagsHtml = visibleTags.length
    ? `<div class="game-card__tags">${visibleTags
        .map(t => `<span class="card-tag">${t}</span>`)
        .join('')}</div>`
    : `<div class="game-card__tags"></div>`;

  // Data attributes pour sélection, drag&drop et joker
  const dataAttrs = [
    `data-card-code="${card.code}"`,
    handIndex !== null ? `data-hand-index="${handIndex}"` : '',
    card.isJoker ? 'data-joker="true"' : '',
    isLocked ? 'data-locked="true"' : '',
    selected ? 'data-selected="true"' : '',
    isComboSelected ? 'data-combo-selected="true"' : '',
    inHand && !isLocked ? 'draggable="true"' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${classes.join(' ')}" ${dataAttrs}>
      ${hintHtml}
      <div class="game-card__header">
        <span class="game-card__type-badge">${getTypeBadgeLabel(card)}</span>
        ${valueHtml}
      </div>
      <div class="game-card__emoji">${card.emoji}</div>
      <div class="game-card__title">${title}</div>
      <div class="game-card__description"><span>${description}</span></div>
      ${tagsHtml}
    </div>
  `;
}
