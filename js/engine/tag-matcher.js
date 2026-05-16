/**
 * RedFlag — Tag Matcher
 *
 * Module clé du jeu : croise les tags d'une carte avec les traits actifs
 * du Crush pour détecter les coups critiques, les retournements de veste,
 * et les conditions des cartes conditionnelles.
 */

import { GAME_CONFIG } from '../config/game-constants.js';

/**
 * Récupère tous les tags d'une carte (visibles + cachés).
 */
export function getAllCardTags(card) {
  return [
    ...(card.displayedTags || []),
    ...(card.hiddenTags || []),
  ];
}

/**
 * Compte le nombre de tags d'affinité du Crush qu'une carte matche.
 */
export function countAffinityMatches(card, activeTraits) {
  const cardTags = new Set(getAllCardTags(card));
  let count = 0;

  for (const trait of activeTraits) {
    for (const tag of (trait.affinity || [])) {
      if (cardTags.has(tag)) count++;
    }
  }

  return count;
}

/**
 * Compte le nombre de tags d'aversion du Crush qu'une carte matche.
 */
export function countAversionMatches(card, activeTraits) {
  const cardTags = new Set(getAllCardTags(card));
  let count = 0;

  for (const trait of activeTraits) {
    for (const tag of (trait.aversion || [])) {
      if (cardTags.has(tag)) count++;
    }
  }

  return count;
}

/**
 * Détecte si jouer cette carte va déclencher un Coup Critique.
 *
 * Règles :
 * - Green Flag qui matche une AFFINITÉ → critique (le Crush adore)
 * - Red Flag qui matche une AVERSION → critique (le Crush déteste)
 * - 1 match = critique simple (x2)
 * - 2+ matches = double critique (x3) — ex: matche Trait Principal + Sous-Trait
 */
export function detectCriticalHit(card, activeTraits) {
  const isGreen = card.value > 0;
  const matchCount = isGreen
    ? countAffinityMatches(card, activeTraits)
    : countAversionMatches(card, activeTraits);

  return {
    isCritical: matchCount >= 1,
    isDoubleCritical: matchCount >= 2,
    matchCount,
    multiplier: matchCount >= 2
      ? GAME_CONFIG.DOUBLE_CRITICAL_MULTIPLIER
      : (matchCount === 1 ? GAME_CONFIG.CRITICAL_MULTIPLIER : 1),
  };
}

/**
 * Calcule la valeur effective d'une carte après application des critiques.
 */
export function calculateEffectiveValue(card, activeTraits) {
  const baseValue = card.value;
  const { multiplier } = detectCriticalHit(card, activeTraits);
  return baseValue * multiplier;
}

/**
 * Évalue une carte conditionnelle dans le contexte des traits actifs.
 *
 * NOUVELLE LOGIQUE (cahier des charges) :
 * - Toutes les conditionnelles sont TOUJOURS jouables (canPlay: true)
 * - L'effet S'INVERSE selon le matching :
 *   - Si requiresAnyTag est matché → effet positif (valueIfMatch ou card.value)
 *   - Sinon → effet inversé (signe opposé, ou valueIfNoMatch fournie)
 */
export function evaluateConditionalCard(card, activeTraits) {
  if (card.type !== 'conditional' || !card.conditional) {
    return { canPlay: true, value: card.value, conditionMet: true };
  }

  const { requiresAnyTag, valueIfMatch, valueIfNoMatch } = card.conditional;

  const allCrushTags = activeTraits.flatMap(t => [
    ...(t.affinity || []),
    ...(t.aversion || []),
  ]);
  const matches = requiresAnyTag.some(tag => allCrushTags.includes(tag));

  if (matches) {
    return {
      canPlay: true,
      value: valueIfMatch ?? card.value,
      conditionMet: true,
    };
  }

  // Condition non remplie : inversion automatique
  const invertedValue = valueIfNoMatch !== undefined ? valueIfNoMatch : -card.value;

  return {
    canPlay: true,
    value: invertedValue,
    conditionMet: false,
    isFallback: true,
  };
}

/**
 * Détermine si une carte (Green ou Red Flag) doit s'inverser selon les
 * traits actifs du Crush au moment du jeu.
 *
 * - Green Flag avec tags qui matchent une AVERSION → devient Red
 * - Red Flag avec tags qui matchent une AFFINITÉ → devient Green
 */
export function evaluateDynamicFlagInversion(card, activeTraits) {
  if (!card || (card.type !== 'green_flag' && card.type !== 'red_flag')) {
    return { isFallback: false, finalValue: card?.value || 0 };
  }

  const cardTags = new Set(getAllCardTags(card));
  const isGreen = card.value > 0;

  let shouldInvert = false;
  for (const trait of activeTraits) {
    if (isGreen) {
      const matchesAversion = (trait.aversion || []).some(t => cardTags.has(t));
      if (matchesAversion) shouldInvert = true;
    } else {
      const matchesAffinity = (trait.affinity || []).some(t => cardTags.has(t));
      if (matchesAffinity) shouldInvert = true;
    }
  }

  if (shouldInvert) {
    return {
      isFallback: true,
      finalValue: -card.value,
    };
  }

  return { isFallback: false, finalValue: card.value };
}

/**
 * Détecte les flags actifs sur un profil qui devraient se RETOURNER
 * suite à la révélation d'un nouveau trait du Crush.
 *
 * Un Green Flag posé qui matche maintenant une AVERSION du Crush
 * doit devenir un Red Flag. Et vice-versa.
 */
export function detectFlipsForNewTrait(activeFlags, newTrait) {
  const flipsToApply = [];

  for (const flag of activeFlags) {
    if (flag.flippedFromGreen) continue; // Déjà flippé, on n'inverse pas une 2ᵉ fois

    const flagTags = new Set(flag.tags || []);

    // Green Flag posé : flippe en Red s'il matche une aversion du nouveau trait
    if (flag.type === 'green') {
      const matchesAversion = (newTrait.aversion || []).some(t => flagTags.has(t));
      if (matchesAversion) {
        flipsToApply.push({
          flagId: flag.id,
          fromType: 'green',
          toType: 'red',
          oldValue: flag.value,
          newValue: -Math.abs(flag.value) - 10, // Pénalité +10 sur le flip
        });
      }
    }
    // Note : on pourrait aussi flipper Red → Green si le Crush "valorise"
    // ce qu'il détestait avant, mais on garde simple pour la V1 (one-way flip)
  }

  return flipsToApply;
}

/**
 * Détecte les COMBOS de tags : 2+ Green Flags partageant un tag commun
 * sur le profil d'un joueur déclenchent un bonus.
 */
export function detectComboBonus(activeFlags) {
  const greenFlags = activeFlags.filter(f => f.type === 'green');
  if (greenFlags.length < 2) return { hasCombo: false, bonus: 0, sharedTags: [] };

  // Map : tag → nombre de Green Flags qui le portent
  const tagCount = new Map();
  for (const flag of greenFlags) {
    for (const tag of (flag.tags || [])) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    }
  }

  const sharedTags = [...tagCount.entries()]
    .filter(([_, count]) => count >= 2)
    .map(([tag]) => tag);

  return {
    hasCombo: sharedTags.length > 0,
    bonus: sharedTags.length * GAME_CONFIG.COMBO_TAG_BONUS,
    sharedTags,
  };
}
