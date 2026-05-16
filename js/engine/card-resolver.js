/**
 * RedFlag — Card Resolver
 *
 * Applique les effets d'une carte sur l'état du jeu.
 * C'est le module le plus dense : il gère TOUS les types de cartes.
 */

import { getCard } from '../data/cards-catalog.js';
import { getTrait } from '../data/traits-catalog.js';
import {
  CARD_TYPES,
  ACTION_EFFECTS,
  GAME_CONFIG,
} from '../config/game-constants.js';
import {
  detectCriticalHit,
  evaluateConditionalCard,
  detectComboBonus,
} from './tag-matcher.js';
import { uid, clamp, shuffled } from '../utils/helpers.js';

/**
 * Récupère la liste des objets Trait actifs (résolution des IDs).
 */
function getActiveTraits(gameState) {
  return (gameState.crush?.revealedTraits || [])
    .filter(t => t.isActive)
    .map(t => getTrait(t.traitId))
    .filter(Boolean);
}

/**
 * Applique une variation de jauge à un joueur, clampée entre 0 et 100.
 * Recalcule aussi le bonus combo après mise à jour des flags.
 */
/**
 * Applique une variation de jauge à un joueur.
 * La jauge peut désormais descendre jusqu'à MIN_GAUGE (-100).
 * Détecte le passage en danger (≤ -100%) et le retour à l'imminent (≥100%).
 */
function applyGaugeChange(player, delta) {
  const oldGauge = player.profile.seductionGauge;
  const newGauge = clamp(
    oldGauge + delta,
    GAME_CONFIG.MIN_GAUGE,
    GAME_CONFIG.MAX_GAUGE
  );
  player.profile.seductionGauge = newGauge;
  player.profile.isDateImminent = newGauge >= GAME_CONFIG.DATE_IMMINENT_THRESHOLD;

  // Gestion du statut "en danger" (≤ -100%)
  const wasDanger = player.profile.isInDanger;
  const isDanger = newGauge <= GAME_CONFIG.DANGER_THRESHOLD;
  player.profile.isInDanger = isDanger;

  if (isDanger && !wasDanger) {
    // Vient d'entrer en danger : marquer le tour
    player.profile.dangerStartedAtTurn = null; // sera fixé au prochain endTurn
  } else if (!isDanger && wasDanger) {
    // Sort du danger
    player.profile.dangerStartedAtTurn = null;
  }

  return { oldGauge, newGauge };
}

/**
 * Pose un flag (Green ou Red) sur le profil d'un joueur.
 */
function placeFlag(player, card, type, effectiveValue) {
  const flag = {
    id: uid('flag'),
    cardCode: card.code,
    cardName: card.name,
    cardEmoji: card.emoji,
    type, // 'green' ou 'red'
    value: effectiveValue,
    tags: [...(card.displayedTags || []), ...(card.hiddenTags || [])],
    placedAt: Date.now(),
    flippedFromGreen: false,
  };
  player.profile.activeFlags.push(flag);
  return flag;
}

/**
 * Recalcule le bonus combo d'un joueur après modification de ses flags.
 */
function recomputeComboBonus(player) {
  const combo = detectComboBonus(player.profile.activeFlags);
  const oldBonus = player.profile.comboBonus || 0;
  const newBonus = combo.bonus;
  const delta = newBonus - oldBonus;
  player.profile.comboBonus = newBonus;
  return { oldBonus, newBonus, delta, sharedTags: combo.sharedTags };
}

/**
 * Joue une carte. Retourne un objet "résultat" décrivant ce qui s'est passé,
 * que l'UI utilisera pour les animations et l'affichage.
 *
 * IMPORTANT : cette fonction MUTE l'état (gameState passé en référence).
 * On considère que c'est OK car on travaille sur une COPIE de l'état dans
 * le state manager. C'est plus simple que de tout reconstruire à chaque action.
 */
export function resolvePlayCard({
  gameState,
  playerUid,
  cardCode,
  targetUid = null, // Cible pour les cartes au choix
  options = {}, // Pour cartes à choix multiple (peek replacement, swap target, etc.)
}) {
  const card = getCard(cardCode);
  if (!card) {
    return { success: false, error: 'Carte inconnue' };
  }

  const player = gameState.players[playerUid];
  if (!player) {
    return { success: false, error: 'Joueur inconnu' };
  }

  // Retire la carte de la main du joueur
  const handIndex = player.hand.indexOf(cardCode);
  if (handIndex === -1) {
    return { success: false, error: "Carte absente de la main" };
  }
  player.hand.splice(handIndex, 1);

  const activeTraits = getActiveTraits(gameState);
  const result = {
    success: true,
    card,
    playerUid,
    targetUid,
    effects: [],
  };

  // Dispatch selon le type de carte
  switch (card.type) {
    case CARD_TYPES.GREEN_FLAG:
      handleFlag(card, gameState, playerUid, targetUid, activeTraits, 'green', result);
      break;

    case CARD_TYPES.RED_FLAG:
      handleFlag(card, gameState, playerUid, targetUid, activeTraits, 'red', result);
      break;

    case CARD_TYPES.CONDITIONAL:
      handleConditional(card, gameState, playerUid, targetUid, activeTraits, result);
      break;

    case CARD_TYPES.SHIELD:
      handleShield(card, player, result);
      break;

    case CARD_TYPES.ACTION:
      handleAction(card, gameState, playerUid, targetUid, options, result);
      break;

    case CARD_TYPES.DRAW:
      // Géré par chain-handler, pas ici
      result.handledByChain = true;
      break;

    case CARD_TYPES.SKIP:
      // Skip standard : passe le tour du joueur suivant (stun simple)
      // Super Skip : annule la chaîne en cours (handled by action effect)
      handleSkipCard(card, gameState, playerUid, targetUid, result);
      break;
  }

  // ROLLBACK : si l'action a échoué après que la carte a été retirée, on la remet en main
  if (!result.success) {
    player.hand.splice(handIndex, 0, cardCode);
  }

  return result;
}

/**
 * Gère la pose d'un Green ou Red Flag.
 */
function handleFlag(card, gameState, playerUid, targetUid, activeTraits, flagType, result) {
  const target = gameState.players[targetUid || playerUid];
  if (!target || target.isGhosted) {
    result.success = false;
    result.error = 'Cible invalide';
    return;
  }

  // Détection du critique
  const crit = detectCriticalHit(card, activeTraits);
  const baseValue = card.value;
  const effectiveValue = baseValue * crit.multiplier;

  // Si le joueur a un bouclier ET que c'est un Red Flag → on absorbe
  if (flagType === 'red' && target.profile.shieldActive) {
    target.profile.shieldActive = false;
    result.effects.push({
      type: 'shield_consumed',
      targetUid: target.uid,
      cardCode: card.code,
      attemptedValue: effectiveValue,
    });
    return;
  }

  // Pose le flag
  const placedFlag = placeFlag(target, card, flagType, effectiveValue);

  // Applique l'effet immédiat sur la jauge
  const gaugeDelta = effectiveValue;
  const { oldGauge, newGauge } = applyGaugeChange(target, gaugeDelta);

  // Recalcule combo
  const comboInfo = recomputeComboBonus(target);
  if (comboInfo.delta !== 0) {
    applyGaugeChange(target, comboInfo.delta);
  }

  result.effects.push({
    type: 'flag_placed',
    flagType,
    targetUid: target.uid,
    cardCode: card.code,
    flagId: placedFlag.id,
    isCritical: crit.isCritical,
    isDoubleCritical: crit.isDoubleCritical,
    baseValue,
    effectiveValue,
    gaugeDelta,
    oldGauge,
    newGauge: target.profile.seductionGauge,
    comboTriggered: comboInfo.delta !== 0,
    comboTags: comboInfo.sharedTags,
  });
}

/**
 * Gère une carte conditionnelle.
 */
function handleConditional(card, gameState, playerUid, targetUid, activeTraits, result) {
  const evaluation = evaluateConditionalCard(card, activeTraits);
  // evaluateConditionalCard always returns canPlay:true — condition unmet just inverts value

  const target = gameState.players[targetUid || playerUid];
  if (!target || target.isGhosted) {
    result.success = false;
    result.error = 'Cible invalide';
    return;
  }

  // Détecter aussi les coups critiques sur la valeur conditionnelle
  const crit = detectCriticalHit(card, activeTraits);
  const baseValue = evaluation.value;
  const effectiveValue = baseValue * crit.multiplier;
  const flagType = effectiveValue > 0 ? 'green' : 'red';

  // Bouclier ?
  if (flagType === 'red' && target.profile.shieldActive) {
    target.profile.shieldActive = false;
    result.effects.push({
      type: 'shield_consumed',
      targetUid: target.uid,
      cardCode: card.code,
      attemptedValue: effectiveValue,
    });
    return;
  }

  const placedFlag = placeFlag(target, card, flagType, effectiveValue);
  const { oldGauge } = applyGaugeChange(target, effectiveValue);
  const comboInfo = recomputeComboBonus(target);
  if (comboInfo.delta !== 0) applyGaugeChange(target, comboInfo.delta);

  result.effects.push({
    type: 'flag_placed',
    flagType,
    targetUid: target.uid,
    cardCode: card.code,
    flagId: placedFlag.id,
    isConditional: true,
    isFallback: evaluation.isFallback || false,
    isCritical: crit.isCritical,
    baseValue,
    effectiveValue,
    oldGauge,
    newGauge: target.profile.seductionGauge,
  });
}

/**
 * Gère la pose d'un Bouclier sur soi.
 */
function handleShield(card, player, result) {
  if (player.profile.shieldActive) {
    result.success = false;
    result.error = 'Tu as déjà un bouclier actif';
    return;
  }
  player.profile.shieldActive = true;
  result.effects.push({
    type: 'shield_activated',
    targetUid: player.uid,
  });
}

/**
 * Gère une carte Skip / Super Skip.
 *
 * SKIP standard : le joueur saute sa phase de pioche de fin de tour.
 * SUPER SKIP : si en chaîne pioche, annule la chaîne + saute pioche.
 *              Hors chaîne, équivalent à SKIP standard.
 */
function handleSkipCard(card, gameState, playerUid, targetUid, result) {
  const isSuperSkip = card.code?.startsWith('SUPER') || card.actionEffect === 'super_skip';

  // Super Skip pendant une chaîne : annule la chaîne (le joueur en sort indemne)
  if (isSuperSkip && gameState.activeChain && gameState.activeChain.currentTargetUid === playerUid) {
    const chainHistory = [...gameState.activeChain.chainHistory];
    gameState.activeChain = null;
    result.effects.push({
      type: 'chain_canceled',
      cardCode: card.code,
      canceledBy: playerUid,
      chainHistory,
    });
    // En sortant d'une chaîne via Super Skip, le tour passe quand même
    gameState.turn.skipDrawForUid = playerUid;
    return;
  }

  // SKIP standard sur soi : saute la pioche de fin de tour
  // ✅ FIX : Skip ne bloque PAS les autres cartes (pas de mustEndTurn)
  // Le joueur peut encore jouer des cartes ce tour, mais quand il finira il ne piochera pas
  gameState.turn.skipDrawForUid = playerUid;
  result.effects.push({
    type: 'turn_skipped',
    targetUid: playerUid,
    cardCode: card.code,
    isSuperSkip,
  });
}

/**
 * Gère les cartes Action (vol, stun, peek, etc.).
 */
function handleAction(card, gameState, playerUid, targetUid, options, result) {
  const player = gameState.players[playerUid];
  const target = targetUid ? gameState.players[targetUid] : null;

  switch (card.actionEffect) {

    case ACTION_EFFECTS.PURGE_RED_FLAGS: {
      const before = player.profile.activeFlags.length;
      const removed = player.profile.activeFlags.filter(f => f.type === 'red');
      player.profile.activeFlags = player.profile.activeFlags.filter(f => f.type !== 'red');
      // Re-applique les valeurs (les Red Flags étaient déjà appliqués à la jauge)
      let totalRecovered = 0;
      for (const flag of removed) {
        totalRecovered += Math.abs(flag.value);
      }
      applyGaugeChange(player, totalRecovered);
      const comboInfo = recomputeComboBonus(player);
      if (comboInfo.delta !== 0) applyGaugeChange(player, comboInfo.delta);
      result.effects.push({
        type: 'purged_red_flags',
        targetUid: player.uid,
        removedCount: removed.length,
        recovered: totalRecovered,
      });
      break;
    }

    case ACTION_EFFECTS.PURGE_AND_BOOST: {
      const removed = player.profile.activeFlags.filter(f => f.type === 'red');
      player.profile.activeFlags = player.profile.activeFlags.filter(f => f.type !== 'red');
      let total = 0;
      for (const flag of removed) total += Math.abs(flag.value);
      total += card.value; // bonus de la carte (ex: +5%)
      applyGaugeChange(player, total);
      result.effects.push({
        type: 'purge_and_boost',
        targetUid: player.uid,
        recovered: total,
      });
      break;
    }

    // AC-03 Spa Week-End : purge les Red Flags + immunité au prochain Red Flag
    case ACTION_EFFECTS.PURGE_AND_IMMUNITY: {
      const removedImmune = player.profile.activeFlags.filter(f => f.type === 'red');
      player.profile.activeFlags = player.profile.activeFlags.filter(f => f.type !== 'red');
      let totalImmune = 0;
      for (const flag of removedImmune) totalImmune += Math.abs(flag.value);
      applyGaugeChange(player, totalImmune);
      const comboImmune = recomputeComboBonus(player);
      if (comboImmune.delta !== 0) applyGaugeChange(player, comboImmune.delta);
      // Pose l'immunité : le prochain Red Flag sera absorbé comme un bouclier
      player.profile.shieldActive = true;
      result.skipDraw = true;
      gameState.turn.skipDrawForUid = player.uid;
      result.effects.push({
        type: 'purge_and_immunity',
        targetUid: player.uid,
        removedCount: removedImmune.length,
        recovered: totalImmune,
      });
      break;
    }

    case ACTION_EFFECTS.STEAL_GREEN_FLAG: {
      if (!target) { result.success = false; return; }
      const targetGreens = target.profile.activeFlags.filter(f => f.type === 'green');
      if (targetGreens.length === 0) {
        result.effects.push({ type: 'steal_failed', reason: 'no_green_flags' });
        break;
      }
      const stolen = options.flagId
        ? targetGreens.find(f => f.id === options.flagId) || targetGreens[0]
        : targetGreens[Math.floor(Math.random() * targetGreens.length)];
      target.profile.activeFlags = target.profile.activeFlags.filter(f => f.id !== stolen.id);
      applyGaugeChange(target, -stolen.value);
      const newFlag = { ...stolen, id: uid('flag') };
      player.profile.activeFlags.push(newFlag);
      applyGaugeChange(player, stolen.value);
      // ✅ FIX: apply combo delta after recompute for both players
      const comboTarget = recomputeComboBonus(target);
      if (comboTarget.delta !== 0) applyGaugeChange(target, comboTarget.delta);
      const comboPlayer = recomputeComboBonus(player);
      if (comboPlayer.delta !== 0) applyGaugeChange(player, comboPlayer.delta);
      result.effects.push({
        type: 'green_flag_stolen',
        fromUid: target.uid,
        toUid: player.uid,
        flagValue: stolen.value,
      });
      break;
    }

    case ACTION_EFFECTS.STUN_NEXT_TURN: {
      if (!target) { result.success = false; return; }
      if (!gameState.turn.stunnedPlayers) gameState.turn.stunnedPlayers = [];
      if (!gameState.turn.stunnedPlayers.includes(target.uid)) {
        gameState.turn.stunnedPlayers.push(target.uid);
      }
      result.effects.push({
        type: 'stunned',
        targetUid: target.uid,
      });
      break;
    }

    case ACTION_EFFECTS.STUN_AND_DAMAGE: {
      if (!target) { result.success = false; return; }
      if (!gameState.turn.stunnedPlayers) gameState.turn.stunnedPlayers = [];
      gameState.turn.stunnedPlayers.push(target.uid);
      applyGaugeChange(target, card.value); // -10%
      result.effects.push({
        type: 'stun_and_damage',
        targetUid: target.uid,
        damage: card.value,
      });
      break;
    }

    case ACTION_EFFECTS.SKIP_DRAW:
    case ACTION_EFFECTS.BLOCK: {
      result.skipDraw = true;
      gameState.turn.skipDrawForUid = player.uid; // ⚠️ Propage au state pour endTurn
      result.effects.push({ type: 'skipped_draw', playerUid: player.uid });
      if (card.actionEffect === ACTION_EFFECTS.BLOCK) {
        if (!gameState.turn.immunityNextTurn) gameState.turn.immunityNextTurn = [];
        gameState.turn.immunityNextTurn.push(player.uid);
      }
      break;
    }

    case ACTION_EFFECTS.SHUFFLE_DECK: {
      gameState.deck.drawPile = shuffled(gameState.deck.drawPile);
      result.effects.push({ type: 'deck_shuffled' });
      break;
    }

    case ACTION_EFFECTS.SWAP_HANDS: {
      if (!target) { result.success = false; return; }
      const tempHand = player.hand;
      player.hand = target.hand;
      target.hand = tempHand;
      // ✅ FIX : force re-render des deux mains
      player.handVersion = (player.handVersion || 0) + 1;
      target.handVersion = (target.handVersion || 0) + 1;
      result.effects.push({
        type: 'hands_swapped',
        playerUid: player.uid,
        targetUid: target.uid,
      });
      break;
    }

    // ✅ Stalker : mémorise les 3 prochaines cartes dans le state pour affichage UI
    case ACTION_EFFECTS.PEEK_DECK: {
      const peek = gameState.deck.drawPile.slice(-3).reverse();
      result.skipDraw = true;
      gameState.turn.skipDrawForUid = player.uid;
      result.peekedCards = peek;
      result.effects.push({ type: 'peeked_deck', cards: peek });
      // Stocke dans le state pour que le controller l'affiche
      gameState.pendingPeekDeck = { playerUid, cards: peek };
      break;
    }

    case ACTION_EFFECTS.PEEK_HAND: {
      if (!target) { result.success = false; return; }
      const peekedCards = [...target.hand];
      result.peekedHand = peekedCards;
      result.effects.push({
        type: 'peeked_hand',
        targetUid: target.uid,
        cards: peekedCards,
      });
      // Stocke dans le state pour affichage UI
      gameState.pendingPeekHand = { viewerUid: playerUid, targetUid: target.uid, cards: peekedCards };
      break;
    }

    case ACTION_EFFECTS.TRANSFORM_FLAG: {
      // Subtilité : transforme un Red Flag posé en Green Flag
      const reds = player.profile.activeFlags.filter(f => f.type === 'red');
      if (reds.length === 0) {
        result.success = false;
        result.error = 'Pas de Red Flag à transformer';
        return;
      }
      // Prend le pire Red Flag (le plus négatif) et l'inverse
      const worst = reds.sort((a, b) => a.value - b.value)[0];
      const oldValue = worst.value;
      const newValue = Math.abs(oldValue); // -25 → +25
      worst.type = 'green';
      worst.value = newValue;
      worst.flippedFromGreen = false;
      // La jauge passe de -X à +X (delta = +2X en valeur absolue)
      applyGaugeChange(player, -oldValue + newValue);
      recomputeComboBonus(player);
      result.effects.push({
        type: 'flag_transformed',
        targetUid: player.uid,
        flagId: worst.id,
        oldValue,
        newValue,
      });
      break;
    }

    case ACTION_EFFECTS.TABLE_RASE: {
      const cible = target || player;
      const allFlags = [...cible.profile.activeFlags];
      let totalDelta = 0;
      // Annule les effets de tous les flags (inverser ce qu'ils ont appliqué à la jauge)
      for (const flag of allFlags) {
        totalDelta -= flag.value;
      }
      // ✅ FIX : aussi annuler le combo bonus qui avait été appliqué à la jauge
      const oldComboBonus = cible.profile.comboBonus || 0;
      totalDelta -= oldComboBonus;

      cible.profile.activeFlags = [];
      cible.profile.comboBonus = 0;
      applyGaugeChange(cible, totalDelta);
      result.effects.push({
        type: 'table_rase',
        targetUid: cible.uid,
        flagsRemoved: allFlags.length,
        gaugeDelta: totalDelta,
      });
      break;
    }

    case ACTION_EFFECTS.SUPER_SKIP: {
      // Annule la chaîne de pioche entière
      if (gameState.activeChain) {
        gameState.activeChain = null;
        result.effects.push({ type: 'chain_canceled', playerUid: player.uid });
      }
      result.skipDraw = true;
      gameState.turn.skipDrawForUid = player.uid;
      result.effects.push({ type: 'skipped_draw', playerUid: player.uid });
      break;
    }

    // ====================================================================
    // Cartes Exploding Kittens style
    // ====================================================================

    case ACTION_EFFECTS.SHUFFLE_CHOICE: {
      // Joueur va choisir : marque l'action en attente
      gameState.pendingShuffle = {
        playerUid: player.uid,
        startedAt: Date.now(),
      };
      result.effects.push({ type: 'shuffle_pending', playerUid: player.uid });
      result.requiresResolution = 'shuffle_choice';
      break;
    }

    case ACTION_EFFECTS.FAVOR: {
      // Joueur a ciblé un adversaire ; ce dernier doit choisir une carte à donner
      if (!target) {
        result.success = false;
        result.error = 'Cible requise';
        return;
      }
      if (target.hand.length === 0) {
        result.success = false;
        result.error = 'Cible main vide';
        return;
      }
      gameState.pendingFavor = {
        requesterUid: player.uid,
        targetUid: target.uid,
        startedAt: Date.now(),
      };
      result.effects.push({
        type: 'favor_requested',
        requesterUid: player.uid,
        targetUid: target.uid,
      });
      result.requiresResolution = 'favor';
      break;
    }

    case ACTION_EFFECTS.SEE_THE_FUTURE: {
      // Révélation publique des 3 prochaines cartes du deck
      const drawPile = gameState.deck.drawPile || [];
      const next3 = drawPile.slice(-3).reverse(); // les 3 prochaines (top du deck = fin du tableau)
      gameState.publicReveal = {
        cards: next3,
        revealedBy: player.uid,
        expiresAt: Date.now() + 8000,
      };
      result.effects.push({
        type: 'see_the_future',
        playerUid: player.uid,
        cards: next3,
      });
      break;
    }

    case ACTION_EFFECTS.ALTER_THE_FUTURE: {
      // Le joueur va voir et réorganiser les 3 prochaines (privé)
      const drawPile = gameState.deck.drawPile || [];
      const next3 = drawPile.slice(-3).reverse();
      gameState.pendingAlterFuture = {
        playerUid: player.uid,
        cards: next3,
        startedAt: Date.now(),
      };
      result.effects.push({
        type: 'alter_future_pending',
        playerUid: player.uid,
        cards: next3,
      });
      result.requiresResolution = 'alter_future';
      break;
    }

    case ACTION_EFFECTS.DRAW_FROM_BOTTOM: {
      // ✅ NOUVELLE RÈGLE : voir la dernière carte (privé) et décider de la prendre ou non.
      // Dans tous les cas, skipDraw = true (passe le tour).
      const drawPile = gameState.deck.drawPile || [];
      if (drawPile.length === 0) {
        result.success = false;
        result.error = 'Deck vide';
        return;
      }
      const bottomCard = drawPile[0]; // peek sans retirer
      result.effects.push({
        type: 'peek_bottom',
        playerUid: player.uid,
        cardCode: bottomCard,
      });
      gameState.pendingPeekBottom = {
        playerUid: player.uid,
        cardCode: bottomCard,
      };
      result.skipDraw = true; // passe le tour dans tous les cas
      gameState.turn.skipDrawForUid = player.uid;
      break;
    }

    // AC-05 : Potin de Groupe — vol un Green Flag + force la cible à piocher (chaîne 1)
    case ACTION_EFFECTS.STEAL_AND_FORCE_DRAW: {
      if (!target) { result.success = false; return; }
      const targetGreens = target.profile.activeFlags.filter(f => f.type === 'green');
      if (targetGreens.length > 0) {
        const stolen = targetGreens[Math.floor(Math.random() * targetGreens.length)];
        target.profile.activeFlags = target.profile.activeFlags.filter(f => f.id !== stolen.id);
        applyGaugeChange(target, -stolen.value);
        const newFlag = { ...stolen, id: uid('flag') };
        player.profile.activeFlags.push(newFlag);
        applyGaugeChange(player, stolen.value);
        const ct = recomputeComboBonus(target); if (ct.delta !== 0) applyGaugeChange(target, ct.delta);
        const cp = recomputeComboBonus(player); if (cp.delta !== 0) applyGaugeChange(player, cp.delta);
        result.effects.push({ type: 'green_flag_stolen', fromUid: target.uid, toUid: player.uid, flagValue: stolen.value });
      }
      // Force la cible à piocher 1 carte (mini-chaîne)
      if (!gameState.activeChain) {
        gameState.activeChain = {
          id: uid('chain'),
          totalToDraw: 1,
          originPlayerUid: player.uid,
          currentTargetUid: target.uid,
          chainHistory: [{ playerUid: player.uid, cardCode: card.code, valueAdded: 1, timestamp: Date.now() }],
          expiresAt: Date.now() + 8000,
          selfPenalty: 0,
        };
        result.effects.push({ type: 'chain_started', targetUid: target.uid });
      }
      break;
    }

    // AC-06 : Rumeur Virale — vol un Green Flag + colle un Red Flag -10
    case ACTION_EFFECTS.STEAL_AND_PLACE_RED: {
      if (!target) { result.success = false; return; }
      const tGreens = target.profile.activeFlags.filter(f => f.type === 'green');
      if (tGreens.length > 0) {
        const stolen2 = tGreens[Math.floor(Math.random() * tGreens.length)];
        target.profile.activeFlags = target.profile.activeFlags.filter(f => f.id !== stolen2.id);
        applyGaugeChange(target, -stolen2.value);
        const nf = { ...stolen2, id: uid('flag') };
        player.profile.activeFlags.push(nf);
        applyGaugeChange(player, stolen2.value);
        const ct2 = recomputeComboBonus(target); if (ct2.delta !== 0) applyGaugeChange(target, ct2.delta);
        const cp2 = recomputeComboBonus(player); if (cp2.delta !== 0) applyGaugeChange(player, cp2.delta);
        result.effects.push({ type: 'green_flag_stolen', fromUid: target.uid, toUid: player.uid, flagValue: stolen2.value });
      }
      // Pose aussi un Red Flag de base (-10) sur la cible
      const redFlag = placeFlag(target, { ...card, value: -10, code: card.code }, 'red', -10);
      applyGaugeChange(target, -10);
      const cr2 = recomputeComboBonus(target); if (cr2.delta !== 0) applyGaugeChange(target, cr2.delta);
      result.effects.push({ type: 'flag_placed', flagType: 'red', targetUid: target.uid, effectiveValue: -10, flagId: redFlag.id });
      break;
    }

    // AC-09 : Alerte Groupe WhatsApp — stun 2 cibles au choix (via options.targets[])
    case ACTION_EFFECTS.STUN_TWO_TARGETS: {
      // target = cible principale (options.targets peut contenir 2 UIDs si le UI les passe)
      if (!gameState.turn.stunnedPlayers) gameState.turn.stunnedPlayers = [];
      const targets2 = options.targets && Array.isArray(options.targets)
        ? options.targets.slice(0, 2).map(uid => gameState.players[uid]).filter(Boolean)
        : (target ? [target] : []);
      for (const t of targets2) {
        if (!gameState.turn.stunnedPlayers.includes(t.uid)) {
          gameState.turn.stunnedPlayers.push(t.uid);
          result.effects.push({ type: 'stunned', targetUid: t.uid });
        }
      }
      break;
    }

    default:
      result.effects.push({ type: 'action_not_implemented', effect: card.actionEffect });
  }
}

/**
 * Applique le retournement d'un flag (Green → Red).
 */
export function applyFlip(player, flagId, newValue) {
  const flag = player.profile.activeFlags.find(f => f.id === flagId);
  if (!flag) return null;

  const oldValue = flag.value;
  flag.type = 'red';
  flag.value = newValue;
  flag.flippedFromGreen = true;

  // Réajuste la jauge : on retire le bonus, on applique le malus
  applyGaugeChange(player, -oldValue + newValue);
  recomputeComboBonus(player);

  return { flagId, oldValue, newValue };
}
