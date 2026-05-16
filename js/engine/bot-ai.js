/**
 * RedFlag — Bot AI V5
 *
 * Améliorations :
 * - Gère toutes les cartes Exploding Kittens (Mélanger, Faveur, Divination, Changer l'Avenir, Retournement)
 * - Gère Skip, Super Skip
 * - Gère Subtilité, Table Rase
 * - 3 niveaux de difficulté (easy / normal / hard)
 * - Cible Red Flag jamais sur soi
 * - Combo Crush exclut les Joker-only
 * - Approche par scoring : chaque carte reçoit un score de priorité, on joue la meilleure
 * - Randomisation pour casser la prédictibilité
 */

import { getCard, CARDS_CATALOG } from '../data/cards-catalog.js';
import { CARD_TYPES, ACTION_EFFECTS } from '../config/game-constants.js';
import { evaluateConditionalCard } from './tag-matcher.js';
import { getTrait } from '../data/traits-catalog.js';
import { randomFrom } from '../utils/helpers.js';

// Niveau de difficulté global (peut être réglé via setBotDifficulty)
let DIFFICULTY = 'normal'; // 'easy' | 'normal' | 'hard'

export function setBotDifficulty(level) {
  if (['easy', 'normal', 'hard'].includes(level)) {
    DIFFICULTY = level;
  }
}

/** Coefficient de hasard selon difficulté : easy = 50% random, normal = 15%, hard = 5% */
function getRandomnessFactor() {
  return { easy: 0.5, normal: 0.15, hard: 0.05 }[DIFFICULTY] || 0.15;
}

/**
 * Décision principale. Retourne :
 *   { action: 'play', cardCode, targetUid }
 *   { action: 'pass' }
 */
export function decideBotAction(state, botUid) {
  const bot = state.players[botUid];
  if (!bot || bot.isGhosted) return { action: 'pass' };

  const hand = bot.hand || [];
  if (hand.length === 0) return { action: 'pass' };

  // Si je dois finir mon tour (Red Flag déjà joué) → pass
  if (state.turn?.mustEndTurn) return { action: 'pass' };

  const activeTraits = (state.crush?.revealedTraits || [])
    .filter(t => t.isActive)
    .map(t => getTrait(t.traitId))
    .filter(Boolean);

  const opponents = Object.values(state.players)
    .filter(p => !p.isGhosted && p.uid !== botUid)
    .sort((a, b) => b.profile.seductionGauge - a.profile.seductionGauge);
  const leaderUid = opponents[0]?.uid || null;
  const weakestUid = opponents[opponents.length - 1]?.uid || null;
  const myGauge = bot.profile.seductionGauge;
  const myReds = bot.profile.activeFlags.filter(f => f.type === 'red');
  const myGreens = bot.profile.activeFlags.filter(f => f.type === 'green');
  const greenFlagsPlayed = state.turn?.greenFlagsPlayedThisTurn || 0;
  const redFlagsPlayed = state.turn?.redFlagsPlayedThisTurn || 0;

  // ====================== COMBO CRUSH ======================
  // Cherche un combo possible — exclut les groupes que de Jokers
  const crushInHand = hand
    .map(code => ({ code, card: getCard(code) }))
    .filter(({ card }) => card && card.type === CARD_TYPES.CRUSH);

  const byIdentity = {};
  let allJokers = [];
  for (const { code, card } of crushInHand) {
    if (card.isJoker) {
      allJokers.push(code);
      continue;
    }
    if (!byIdentity[card.crushIdentity]) byIdentity[card.crushIdentity] = [];
    byIdentity[card.crushIdentity].push(code);
  }

  // Un combo valide : au moins 2 cartes de la même identité, OU 1 identité + 1 Joker
  for (const [identity, codes] of Object.entries(byIdentity)) {
    const total = codes.length + allJokers.length;
    if (total >= 2 && codes.length >= 1) {
      // Combo possible
      return { action: 'play', cardCode: codes[0], targetUid: botUid };
    }
  }

  // ====================== SCORING DES CARTES ======================
  /**
   * Pour chaque carte jouable, on calcule un score d'utilité.
   * Plus le score est haut, plus on veut la jouer.
   */
  const scored = [];

  for (const code of hand) {
    const card = getCard(code);
    if (!card) continue;
    if (card.type === CARD_TYPES.CRUSH) continue; // déjà géré
    if (card.type === CARD_TYPES.SHIELD) continue; // ne se joue qu'à la pioche d'un Ghosté
    if (card.type === CARD_TYPES.NOPE) continue; // ne se joue que dans la fenêtre Nope
    if (card.type === CARD_TYPES.DRAW) continue; // pioche : utilisée seulement quand attaqué (chain)

    // Limite Green/Red Flag par tour
    if (card.type === CARD_TYPES.GREEN_FLAG && greenFlagsPlayed >= 1) continue;
    if (card.type === CARD_TYPES.RED_FLAG && redFlagsPlayed >= 1) continue;

    // Conditional non remplie → skip (sauf inversion bonne)
    if (card.type === CARD_TYPES.CONDITIONAL) {
      const evaluation = evaluateConditionalCard(card, activeTraits);
      // V5 : evaluation.canPlay est toujours true mais on a evaluation.isFallback (effet inversé)
      // Si fallback et négatif sur soi → skip
      if (evaluation.isFallback && card.value > 0) continue;
    }

    // Calcul du score
    const { score, target } = scoreCard(card, code, {
      bot, myGauge, myReds, myGreens,
      leaderUid, weakestUid, opponents,
      state, botUid,
      greenFlagsPlayed, redFlagsPlayed,
    });

    if (score < 0) continue; // refus complet
    scored.push({ code, card, score, target });
  }

  if (scored.length === 0) {
    return { action: 'pass' };
  }

  // Trie par score décroissant
  scored.sort((a, b) => b.score - a.score);

  // Application de la randomisation selon difficulté
  const rng = getRandomnessFactor();
  if (Math.random() < rng) {
    // Random : pioche au hasard parmi les 3 meilleures
    const top3 = scored.slice(0, Math.min(3, scored.length));
    const picked = randomFrom(top3);
    return { action: 'play', cardCode: picked.code, targetUid: picked.target };
  }

  const best = scored[0];
  return { action: 'play', cardCode: best.code, targetUid: best.target };
}

/**
 * Calcule le score d'utilité d'une carte pour le bot.
 * Retourne { score, target } — plus le score est élevé, plus la carte est prioritaire.
 *
 * Score 0 = peu utile mais jouable
 * Score < 0 = ne pas jouer
 * Score 100+ = très prioritaire
 */
function scoreCard(card, code, ctx) {
  const { bot, myGauge, myReds, myGreens, leaderUid, weakestUid, opponents, state, botUid, greenFlagsPlayed, redFlagsPlayed } = ctx;

  // GREEN FLAG : toujours sur soi — jamais sur un adversaire
  if (card.type === CARD_TYPES.GREEN_FLAG) {
    if (greenFlagsPlayed >= 1) return { score: -1, target: null };
    // Ne joue pas si déjà à 100%
    if (myGauge >= 100) return { score: -1, target: null };
    let score = 25 + Math.max(0, 60 - myGauge) / 2;
    if (myGauge >= 85) score = 75; // dernier push pour victoire
    return { score, target: botUid }; // TOUJOURS soi-même
  }

  // RED FLAG : uniquement sur l'adversaire avec la meilleure jauge, JAMAIS sur soi
  if (card.type === CARD_TYPES.RED_FLAG) {
    if (redFlagsPlayed >= 1) return { score: -1, target: null };
    if (!leaderUid) return { score: -1, target: null };
    if (card.target === 'self') return { score: -1, target: null };
    // On n'attaque jamais le joueur avec une jauge déjà très basse
    const leaderGauge = state.players[leaderUid]?.profile.seductionGauge || 0;
    let score = 30 + leaderGauge / 3;
    if (leaderGauge >= 70) score += 25;
    const target = card.target === 'next_player' ? null : leaderUid;
    return { score, target };
  }

  // CONDITIONAL : évalue l'effet réel selon les traits actifs du Crush
  if (card.type === CARD_TYPES.CONDITIONAL) {
    const activeTraits = (state.crush?.revealedTraits || [])
      .filter(t => t.isActive)
      .map(t => getTrait(t.traitId))
      .filter(Boolean);
    const ev = evaluateConditionalCard(card, activeTraits);
    const effectiveValue = ev.value;
    const positive = effectiveValue > 0;
    const baseScore = 20 + Math.abs(effectiveValue) / 3;
    if (positive) {
      // Valeur positive → sur soi si jauge pas encore à max
      if (myGauge >= 100) return { score: -1, target: null };
      return { score: myGauge < 80 ? baseScore : baseScore * 0.5, target: botUid };
    } else {
      // Valeur négative → sur le leader
      if (!leaderUid) return { score: -1, target: null };
      return { score: baseScore, target: leaderUid };
    }
  }

  // ACTIONS : par effet
  if (card.type === CARD_TYPES.ACTION) {
    const eff = card.actionEffect;

    // === Effets défensifs ===
    if (eff === ACTION_EFFECTS.TABLE_RASE) {
      // Si le bot a beaucoup de Red Flags sur lui → cible soi
      const redCount = myReds.length;
      if (redCount >= 2) {
        return { score: 80 + redCount * 10, target: botUid };
      }
      // Si le leader a beaucoup de Greens → cible le leader
      const leader = state.players[leaderUid];
      if (leader && leader.profile.activeFlags.filter(f => f.type === 'green').length >= 3) {
        return { score: 70, target: leaderUid };
      }
      return { score: 20, target: botUid };
    }

    if (eff === ACTION_EFFECTS.TRANSFORM_FLAG) {
      // Subtilité : transforme un Red Flag posé sur soi
      if (myReds.length === 0) return { score: -1, target: null };
      return { score: 60 + myReds.length * 5, target: botUid };
    }

    if (eff === ACTION_EFFECTS.SUPER_SKIP) {
      // Joue Super Skip si on est en chaîne ou si on est en danger (jauge négative)
      if (state.activeChain?.currentTargetUid === botUid) {
        return { score: 95, target: botUid };
      }
      if (myGauge < 0) return { score: 50, target: botUid };
      return { score: 10, target: botUid }; // peu utile sinon
    }

    if (card.type === CARD_TYPES.SKIP) {
      // Skip pas trop utile sur son propre tour, garder pour défense
      return { score: 5, target: botUid };
    }

    if (eff === ACTION_EFFECTS.PURGE_RED_FLAGS || eff === 'purge_red_flags' || eff === 'purge_red') {
      if (myReds.length === 0) return { score: -1, target: null };
      return { score: 65 + myReds.length * 10, target: botUid };
    }

    if (eff === 'shield_buff' || eff === 'shield' || eff === 'add_shield') {
      if (bot.profile.shieldActive) return { score: -1, target: null };
      return { score: 35, target: botUid };
    }

    // === Effets offensifs ===
    if (eff === ACTION_EFFECTS.STEAL_GREEN_FLAG) {
      // Voler un Green Flag du leader si possible
      const leader = state.players[leaderUid];
      if (leader && leader.profile.activeFlags.some(f => f.type === 'green')) {
        return { score: 70, target: leaderUid };
      }
      return { score: -1, target: null };
    }

    if (eff === ACTION_EFFECTS.STUN_NEXT_TURN || eff === ACTION_EFFECTS.STUN_AND_DAMAGE || eff === ACTION_EFFECTS.STUN_TWO_TARGETS) {
      // Stun le leader
      if (!leaderUid) return { score: -1, target: null };
      return { score: 50, target: leaderUid };
    }

    if (eff === ACTION_EFFECTS.PEEK_HAND) {
      if (!leaderUid) return { score: -1, target: null };
      return { score: 20, target: leaderUid };
    }

    if (eff === ACTION_EFFECTS.SWAP_HANDS) {
      // Risqué : on échange notre main avec celle du leader.
      // Bonne idée si on a peu de cartes ou si le leader en a beaucoup
      const leader = state.players[leaderUid];
      if (leader && bot.hand.length < leader.hand.length - 1) {
        return { score: 55, target: leaderUid };
      }
      return { score: 5, target: leaderUid };
    }

    if (eff === ACTION_EFFECTS.SHUFFLE_DECK) {
      return { score: 15, target: botUid }; // utilité aléatoire
    }

    // === Cartes Exploding Kittens ===
    if (eff === ACTION_EFFECTS.SHUFFLE_CHOICE) {
      // Mélanger : utile si on suspecte un Ghosté en haut du deck
      // Pas de moyen direct de savoir, on joue avec parcimonie
      return { score: 25, target: botUid };
    }

    if (eff === ACTION_EFFECTS.FAVOR) {
      // Demande une carte au leader (qui choisit)
      if (!leaderUid) return { score: -1, target: null };
      const leader = state.players[leaderUid];
      if (leader.hand.length === 0) return { score: -1, target: null };
      return { score: 35, target: leaderUid };
    }

    if (eff === ACTION_EFFECTS.SEE_THE_FUTURE) {
      // Divination publique : utilité limitée, info partagée
      return { score: 12, target: botUid };
    }

    if (eff === ACTION_EFFECTS.ALTER_THE_FUTURE) {
      // Très utile : permet de connaître et réordonner les 3 prochaines cartes
      return { score: 45, target: botUid };
    }

    if (eff === ACTION_EFFECTS.DRAW_FROM_BOTTOM) {
      // Retournement : utile si on craint une carte au sommet (Ghosté)
      if (state.activeChain) return { score: -1, target: null }; // bloqué pendant chaîne
      return { score: 30, target: botUid };
    }

    // Action inconnue : score moyen par défaut
    let defaultTarget = botUid;
    if (card.target === 'choice') {
      // Si la carte a une valeur positive → soi, négative → leader
      defaultTarget = card.value > 0 ? botUid : leaderUid;
    } else if (card.target === 'next_player') {
      defaultTarget = null;
    } else if (card.target === 'self_or_choice') {
      defaultTarget = botUid;
    }
    return { score: 20, target: defaultTarget };
  }

  return { score: 5, target: botUid };
}

/**
 * Le bot doit-il contrer une chaîne ? Oui s'il a une carte 📲 en main.
 */
export function decideBotChainResponse(state, botUid) {
  const bot = state.players[botUid];
  if (!bot) return null;
  const drawCards = bot.hand.filter(code => {
    const card = getCard(code);
    return card && card.type === CARD_TYPES.DRAW;
  });
  if (drawCards.length === 0) return null;
  // Stratégie : 80% contre si possible
  if (Math.random() < 0.8) return randomFrom(drawCards);
  return null;
}

/**
 * Le bot doit-il utiliser un bouclier face à un Ghosté ? Toujours oui s'il peut.
 */
export function decideBotShieldUse(state, botUid) {
  const bot = state.players[botUid];
  if (!bot) return false;
  const hasShieldInHand = bot.hand.some(code => {
    const card = getCard(code);
    return card && card.type === CARD_TYPES.SHIELD;
  });
  return hasShieldInHand || bot.profile.shieldActive;
}

/**
 * Position où le bot replace une Ghosté.
 * Force position 3+ pour éviter le soft-lock.
 */
export function decideBotGhostedReplacement(deckSize) {
  if (deckSize <= 0) return 0;
  const minPos = Math.min(3, deckSize - 1);
  if (Math.random() < 0.5) {
    // Replace au-dessus mais pas au sommet (offensif modéré)
    return minPos + Math.floor(Math.random() * Math.min(4, deckSize - minPos));
  }
  // Replace au fond (planque)
  return Math.floor(deckSize * (0.6 + Math.random() * 0.35));
}

/**
 * Pour le combo x2 : choisit qui voler (le leader).
 */
export function decideBotComboTarget(state, botUid) {
  const others = Object.values(state.players)
    .filter(p => !p.isGhosted && p.uid !== botUid && p.hand.length > 0)
    .sort((a, b) => b.profile.seductionGauge - a.profile.seductionGauge);
  return others[0]?.uid || null;
}

/**
 * Pour le combo x3 : choisit la cible et une carte EXISTANTE du catalogue à demander.
 */
export function decideBotComboRequest(state, botUid) {
  const targetUid = decideBotComboTarget(state, botUid);
  if (!targetUid) return null;

  // Choisit aléatoirement parmi les vraies cartes communes (Bouclier, Action, Green Flag)
  const candidates = CARDS_CATALOG.filter(c =>
    c.type === CARD_TYPES.SHIELD ||
    c.type === CARD_TYPES.GREEN_FLAG ||
    (c.type === CARD_TYPES.ACTION && !c.isJoker)
  );
  if (candidates.length === 0) return null;
  const requested = randomFrom(candidates).code;
  return { targetUid, requestedCardCode: requested };
}

/**
 * Le bot doit-il jouer un Nope face à une action attaquante ?
 *
 * @param {object} state
 * @param {string} botUid
 * @param {object} actionDescriptor
 * @returns {string|null} Le code de la carte Nope à jouer, ou null
 */
export function decideBotNopeResponse(state, botUid, actionDescriptor) {
  const bot = state.players[botUid];
  if (!bot || bot.isGhosted) return null;

  const nopeCard = bot.hand.find(code => {
    const card = getCard(code);
    return card && card.type === CARD_TYPES.NOPE;
  });
  if (!nopeCard) return null;

  const targetsMe = actionDescriptor?.targetUid === botUid;
  const sourceIsLeader = (() => {
    const opps = Object.values(state.players)
      .filter(p => !p.isGhosted)
      .sort((a, b) => b.profile.seductionGauge - a.profile.seductionGauge);
    return opps[0]?.uid === actionDescriptor?.sourcePlayerUid;
  })();

  // Probabilités selon contexte ET difficulté
  let probability = 0.15;
  if (targetsMe) probability = 0.65;
  else if (sourceIsLeader) probability = 0.35;

  // Modificateur difficulté : easy ne Nope presque jamais, hard nope plus
  if (DIFFICULTY === 'easy') probability *= 0.4;
  else if (DIFFICULTY === 'hard') probability *= 1.4;

  if (Math.random() < probability) return nopeCard;
  return null;
}
