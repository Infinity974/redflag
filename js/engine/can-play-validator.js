/**
 * RedFlag — Validateur de jouabilité (canPlay)
 *
 * Source de vérité unique pour savoir si une carte peut être jouée
 * dans le contexte actuel. Retourne :
 *   { canPlay: true }
 *   { canPlay: false, reason: "Texte explicite pour l'utilisateur" }
 *
 * Utilisé pour griser le bouton Jouer + afficher un toast contextuel.
 */

import { getCard } from '../data/cards-catalog.js';
import { CARD_TYPES, GAME_STATUS } from '../config/game-constants.js';

/**
 * Vérifie si le joueur peut jouer une carte simple (hors combo Crush).
 */
export function canPlayCard(state, playerUid, cardCode) {
  if (!state || state.status === GAME_STATUS.ENDED) {
    return { canPlay: false, reason: 'La partie est terminée.' };
  }

  const player = state.players[playerUid];
  if (!player) return { canPlay: false, reason: 'Joueur inconnu.' };
  if (player.isGhosted) return { canPlay: false, reason: 'Tu es ghosté.' };

  const card = getCard(cardCode);
  if (!card) return { canPlay: false, reason: 'Carte inconnue.' };

  // Hors-tour : seul Nope peut être joué (à condition qu'une fenêtre Nope soit ouverte)
  const isMyTurn = state.turn?.activePlayerUid === playerUid;
  const isInChainTarget = state.activeChain?.currentTargetUid === playerUid;
  const isInNopeWindow = !!state.nopeWindow && state.nopeWindow.openTo.includes(playerUid);

  // ============================================================
  // CARTES JOUABLES HORS DE SON TOUR
  // ============================================================

  // NOPE : seulement pendant une fenêtre Nope
  if (card.type === CARD_TYPES.NOPE) {
    if (!isInNopeWindow) {
      return { canPlay: false, reason: '⏱ Pas de fenêtre Nope ouverte. Attends qu\'un adversaire joue une attaque.' };
    }
    return { canPlay: true };
  }

  // Carte de chaîne (📲) : peut être contrée si on est la cible d'une chaîne
  if (card.type === CARD_TYPES.DRAW && isInChainTarget) {
    return { canPlay: true };
  }

  // SUPER_SKIP pendant une chaîne : annule la chaîne complète (cible légitime)
  if (card.type === CARD_TYPES.SKIP && isInChainTarget &&
      (card.code?.startsWith('SUPER') || card.actionEffect === 'super_skip')) {
    return { canPlay: true };
  }

  // ============================================================
  // CARTES UNIQUEMENT SUR SON TOUR
  // ============================================================

  if (!isMyTurn) {
    return { canPlay: false, reason: 'Ce n\'est pas ton tour.' };
  }

  // Doit finir le tour (Red Flag déjà joué)
  if (state.turn.mustEndTurn) {
    return { canPlay: false, reason: '🔴 Tu dois finir ton tour (clique "Pioche").' };
  }

  // Pendant qu'une chaîne tourne sur quelqu'un d'autre, on attend
  if (state.activeChain && !isInChainTarget) {
    return { canPlay: false, reason: '⏱ Une chaîne est en cours, attends.' };
  }

  // Bouclier : interdit hors-Ghosté
  if (card.type === CARD_TYPES.SHIELD) {
    return {
      canPlay: false,
      reason: '🛡 Le Bouclier ne s\'utilise que face à un Ghosté piochée.',
    };
  }

  // Limite : 1 Green Flag par tour
  if (card.type === CARD_TYPES.GREEN_FLAG && (state.turn.greenFlagsPlayedThisTurn || 0) >= 1) {
    return {
      canPlay: false,
      reason: '🌱 Tu as déjà posé un Green Flag ce tour.',
    };
  }

  // Limite : 1 Red Flag par tour (et il finit le tour)
  if (card.type === CARD_TYPES.RED_FLAG && (state.turn.redFlagsPlayedThisTurn || 0) >= 1) {
    return {
      canPlay: false,
      reason: '🔴 Tu as déjà posé un Red Flag ce tour.',
    };
  }

  // Crush solo : interdit (sauf en combo, géré ailleurs)
  if (card.type === CARD_TYPES.CRUSH) {
    return {
      canPlay: false,
      reason: '💕 Une carte Crush ne se joue qu\'en combo (sélectionne 2+ Crush).',
    };
  }

  // ============================================================
  // VALIDATIONS CONTEXTUELLES — cartes Exploding Kittens
  // ============================================================

  if (card.type === CARD_TYPES.ACTION) {
    const eff = card.actionEffect;
    const drawPileSize = state.deck?.drawPile?.length || 0;

    // Mélanger : besoin d'au moins 2 cartes dans le deck
    if (eff === 'shuffle_choice' && drawPileSize < 2) {
      return { canPlay: false, reason: '🔀 Il faut au moins 2 cartes dans le deck pour Mélanger.' };
    }

    // Divination : besoin de 3 cartes dans le deck
    if (eff === 'see_the_future' && drawPileSize < 3) {
      return { canPlay: false, reason: '🔮 Il faut au moins 3 cartes dans le deck pour Divination.' };
    }

    // Changer l'avenir : besoin de 3 cartes dans le deck
    if (eff === 'alter_the_future' && drawPileSize < 3) {
      return { canPlay: false, reason: '✨ Il faut au moins 3 cartes dans le deck pour Changer l\'Avenir.' };
    }

    // Retournement : besoin d'1 carte dans le deck + pas pendant une chaîne
    if (eff === 'draw_from_bottom') {
      if (drawPileSize < 1) {
        return { canPlay: false, reason: '🔄 Le deck est vide.' };
      }
      if (state.activeChain) {
        return { canPlay: false, reason: '🔄 Retournement non utilisable pendant une chaîne.' };
      }
    }

    // Faveur : la cible doit avoir au moins 1 carte
    // (la cible est choisie via showTargetPicker, on ne peut pas valider ici sans targetUid)
    // Mais on peut au moins vérifier qu'au moins UN adversaire a une carte
    if (eff === 'favor') {
      const someoneHasCards = Object.values(state.players)
        .some(p => p.uid !== playerUid && !p.isGhosted && p.hand.length > 0);
      if (!someoneHasCards) {
        return { canPlay: false, reason: '🙏 Aucun adversaire n\'a de carte à donner.' };
      }
    }

    // Subtilité (transform_flag) : besoin d'au moins 1 Red Flag posé sur soi
    if (eff === 'transform_flag') {
      const hasRed = player.profile.activeFlags.some(f => f.type === 'red');
      if (!hasRed) {
        return { canPlay: false, reason: '🎭 Tu n\'as pas de Red Flag à transformer.' };
      }
    }
  }

  return { canPlay: true };
}

/**
 * Vérifie si le joueur peut jouer un combo Crush.
 */
export function canPlayCrushCombo(state, playerUid, comboCardCodes) {
  const player = state.players[playerUid];
  if (!player) return { canPlay: false, reason: 'Joueur inconnu.' };
  if (player.isGhosted) return { canPlay: false, reason: 'Tu es ghosté.' };

  if (state.turn.activePlayerUid !== playerUid) {
    return { canPlay: false, reason: 'Ce n\'est pas ton tour.' };
  }

  if (state.turn.mustEndTurn) {
    return { canPlay: false, reason: '🔴 Tu dois finir ton tour.' };
  }

  if (!Array.isArray(comboCardCodes) || comboCardCodes.length < 2) {
    return { canPlay: false, reason: '💕 Sélectionne au moins 2 cartes Crush identiques (ou 1 + Joker).' };
  }

  if (comboCardCodes.length > 3) {
    return { canPlay: false, reason: '💕 Maximum 3 cartes pour un combo.' };
  }

  // Vérifie présence en main
  for (const code of comboCardCodes) {
    if (!player.hand.includes(code)) {
      return { canPlay: false, reason: 'Une des cartes n\'est plus en main.' };
    }
  }

  // Vérifie que ce sont bien des Crush et que les identités matchent
  const cards = comboCardCodes.map(c => getCard(c)).filter(Boolean);
  if (cards.some(c => c.type !== CARD_TYPES.CRUSH)) {
    return { canPlay: false, reason: 'Toutes les cartes doivent être des Crush.' };
  }

  const nonJokers = cards.filter(c => !c.isJoker);
  if (nonJokers.length === 0) {
    return { canPlay: false, reason: '💕 Il faut au moins 1 vraie identité (pas que des Jokers).' };
  }

  const identity = nonJokers[0].crushIdentity;
  if (nonJokers.some(c => c.crushIdentity !== identity)) {
    return { canPlay: false, reason: '💕 Les identités doivent être identiques (sauf Jokers).' };
  }

  return { canPlay: true };
}

/**
 * Détermine si le bouton "JOUER" doit être actif et avec quel texte.
 * Retourne un objet pour piloter l'UI.
 */
export function evaluatePlayButton({
  state,
  playerUid,
  selectedCardCode,
  selectedCrushCombo,
  isProcessing,
}) {
  // Aucune sélection
  if (!selectedCardCode && (!selectedCrushCombo || selectedCrushCombo.length === 0)) {
    return {
      enabled: false,
      label: '🎯 JOUER',
      reason: 'Sélectionne d\'abord une carte.',
      cssClass: '',
    };
  }

  if (isProcessing) {
    return {
      enabled: false,
      label: '⏳ ...',
      reason: 'Action en cours.',
      cssClass: 'btn--processing',
    };
  }

  // Combo Crush sélectionné
  if (selectedCrushCombo && selectedCrushCombo.length >= 1) {
    if (selectedCrushCombo.length === 1) {
      return {
        enabled: false,
        label: '💕 SÉLECTIONNE 1 DE PLUS',
        reason: 'Il faut au moins 2 cartes Crush pour un combo.',
        cssClass: 'btn--combo-incomplete',
      };
    }
    const validation = canPlayCrushCombo(state, playerUid, selectedCrushCombo);
    if (!validation.canPlay) {
      return {
        enabled: false,
        label: '💕 INVALIDE',
        reason: validation.reason,
        cssClass: 'btn--invalid',
      };
    }
    return {
      enabled: true,
      label: `💕 COMBO ×${selectedCrushCombo.length}`,
      reason: '',
      cssClass: 'btn--combo',
    };
  }

  // Carte simple
  const validation = canPlayCard(state, playerUid, selectedCardCode);
  if (!validation.canPlay) {
    return {
      enabled: false,
      label: '🚫 IMPOSSIBLE',
      reason: validation.reason,
      cssClass: 'btn--invalid',
    };
  }

  return {
    enabled: true,
    label: '🎯 JOUER',
    reason: '',
    cssClass: '',
  };
}
