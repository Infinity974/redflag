/**
 * RedFlag — Game Controller V4
 *
 * Apports :
 * - Validation centralisée via canPlayValidator (bouton Jouer contextuel)
 * - Fenêtre Nope avec chronomètre 3.5s + chaîne de Nope
 * - Sélection main 100% fiable (clic = sélection nette)
 * - Drag & drop opérationnel
 * - Sécurités try/catch + timeout sur les bots
 * - Cible Table Rase (self ou choice)
 */

import * as GameState from '../engine/game-state.js';
import * as Bot from '../engine/bot-ai.js';
import { evaluatePlayButton, canPlayCard, canPlayCrushCombo } from '../engine/can-play-validator.js';
import { isNopeable, buildActionDescriptor } from '../engine/action-classifier.js';
import { renderGame, setupCardHoverPreview } from '../ui/game-renderer.js';
import { evaluateConditionalCard } from '../engine/tag-matcher.js';
import { getTrait } from '../data/traits-catalog.js';
import {
  showTargetPicker,
  showGhostedReveal,
  showGhostedReplacement,
  showGameEnd,
  showToast,
  showCardRequestPicker,
  showStealHandPicker,
  showShufflePicker,
  showFavorDonor,
  showAlterFutureReorder,
  showDivinationPublic,
  showPeekBottom,
} from '../ui/dialog-manager.js';
import { animateCardPlay } from '../ui/card-animations.js';
import {
  showEpicEffect,
  flyCardTo,
  sendToDiscard,
  sendToPlayer,
  impactPlayer,
  transferBetweenPlayers,
  shakeScreen,
  playCardEffects,
} from '../ui/epic-effects.js';
import { animateGaugeChange } from '../ui/heart-gauge.js';
import { getCard } from '../data/cards-catalog.js';
import { CARD_TYPES, GAME_STATUS, GAME_CONFIG } from '../config/game-constants.js';
import { sleep } from '../utils/helpers.js';

let state = null;
let humanPlayerUid = null;
let selectedCardCode = null;
let selectedCrushCombo = [];
let isProcessing = false;
let gameOptions = {};
let dragSourceIdx = null;
let nopeTimerInterval = null;

// === SESSION TRACKING ===
// À chaque démarrage de partie, on incrémente l'ID de session.
// Tous les setTimeout / setInterval vérifient que leur session est encore active.
// Quand on quitte une partie, on incrémente → tous les timers en cours s'auto-annulent.
let gameSessionId = 0;
let activeTimers = new Set();
let activeIntervals = new Set();

/**
 * Crée un setTimeout qui s'annule automatiquement si la session change.
 * Retourne l'ID pour cancel manuel si besoin.
 */
function sessionTimeout(callback, delay) {
  const sessionAtSchedule = gameSessionId;
  const id = setTimeout(() => {
    activeTimers.delete(id);
    if (sessionAtSchedule !== gameSessionId) {
      // Session changée (partie quittée) → on n'exécute pas le callback
      return;
    }
    callback();
  }, delay);
  activeTimers.add(id);
  return id;
}

/**
 * Crée un setInterval qui s'auto-stoppe si la session change.
 */
function sessionInterval(callback, delay) {
  const sessionAtSchedule = gameSessionId;
  const id = setInterval(() => {
    if (sessionAtSchedule !== gameSessionId) {
      clearInterval(id);
      activeIntervals.delete(id);
      return;
    }
    callback();
  }, delay);
  activeIntervals.add(id);
  return id;
}

/**
 * Termine la session de jeu en cours et nettoie tout.
 * Appelée quand le joueur quitte la partie.
 */
export function endGameSession() {
  gameSessionId++;
  // Annule tous les timers/intervals actifs
  for (const id of activeTimers) clearTimeout(id);
  for (const id of activeIntervals) clearInterval(id);
  activeTimers.clear();
  activeIntervals.clear();
  if (nopeTimerInterval) {
    clearInterval(nopeTimerInterval);
    nopeTimerInterval = null;
  }
  // Reset l'état
  state = null;
  humanPlayerUid = null;
  selectedCardCode = null;
  selectedCrushCombo = [];
  isProcessing = false;
  // Nettoie le DOM des éléments de jeu (banniers, dialogs, etc.)
  document.querySelectorAll('.nope-window-banner--open').forEach(el => el.classList.remove('nope-window-banner--open'));
  document.querySelectorAll('.dialog-overlay, .toast-floating, .card-anim').forEach(el => el.remove());
}

export function startLocalGame(humanNickname, botCount = 4, options = {}) {
  // Nouvelle session → tous les timers de l'ancienne s'auto-annulent
  gameSessionId++;
  isProcessing = false;
  selectedCardCode = null;
  selectedCrushCombo = [];

  gameOptions = options;

  // Applique la difficulté du bot AI
  if (options.difficulty) {
    Bot.setBotDifficulty(options.difficulty);
  }

  let playerSpecs;
  // Si on a déjà des specs (depuis un salon), on les utilise directement
  if (options.playerSpecs && Array.isArray(options.playerSpecs)) {
    playerSpecs = options.playerSpecs;
    humanPlayerUid = options.humanUid || playerSpecs.find(p => !p.isBot)?.uid;
  } else {
    // Sinon on génère depuis humanNickname + botCount (legacy)
    const allColors = ['#FF4FA3', '#9B4FFF', '#4FC3FF', '#39FF6A', '#FFD93D', '#FF6BB3', '#E63946', '#9FE1CB'];
    const playerColor = options.color || '#FF4FA3';
    const botColors = allColors.filter(c => c !== playerColor);

    playerSpecs = [
      { uid: 'human-' + Date.now(), nickname: humanNickname, avatarColor: playerColor },
    ];

    const botNames = ['Marc', 'Léa', 'Sara', 'Tom', 'Nina', 'Hugo', 'Zoé', 'Alex'];
    const shuffledBotNames = [...botNames].sort(() => Math.random() - 0.5);

    for (let i = 0; i < botCount; i++) {
      playerSpecs.push({
        uid: 'bot-' + i + '-' + Date.now(),
        nickname: shuffledBotNames[i],
        avatarColor: botColors[i % botColors.length],
        isBot: true,
      });
    }
    humanPlayerUid = playerSpecs[0].uid;
  }

  state = GameState.createInitialState(playerSpecs, options.gameConfig);
  // Reset les flags isBot dans le state (createInitialState ne les passe pas)
  for (const spec of playerSpecs) {
    if (state.players[spec.uid]) {
      state.players[spec.uid].isBot = !!spec.isBot;
    }
  }
  state.localUI = { selectedCrushCombo: [] };

  // Révèle le nombre de traits demandé au démarrage (1, 2 ou 3)
  const traitsAtStart = options.gameConfig?.traitsAtStart ?? 1;
  for (let i = 0; i < traitsAtStart; i++) {
    if (i > 0) state.currentRound++; // chaque révélation = 1 round
    GameState.revealTraitForCurrentRound(state);
  }
  // Reset le compteur de round à 1 (les traits multiples de start ne sont pas
  // de "vraies" manches)
  if (traitsAtStart > 1) {
    state.currentRound = 1;
    // Marquer tous les traits comme non "newly revealed" sauf le dernier
    state.crush.revealedTraits.forEach((t, i) => {
      t.isNewlyRevealed = (i === state.crush.revealedTraits.length - 1);
    });
  }




  refreshUI();
  setupInputs();
  setupCardHoverPreview();
  scheduleNextBotIfNeeded();
}

function refreshUI() {
  if (!state) return;
  state.localUI = state.localUI || {};
  state.localUI.selectedCrushCombo = selectedCrushCombo;
  state.localUI.selectedCardCode = selectedCardCode;
  renderGame(state, humanPlayerUid);
  updatePlayButton();
}

/**
 * Met à jour l'état du bouton JOUER selon le validateur centralisé.
 */
function updatePlayButton() {
  const playBtn = document.getElementById('playBtn');
  const endTurnBtn = document.getElementById('endTurnBtn');
  if (!playBtn) return;

  const evaluation = evaluatePlayButton({
    state,
    playerUid: humanPlayerUid,
    selectedCardCode,
    selectedCrushCombo,
    isProcessing,
  });

  playBtn.disabled = !evaluation.enabled;
  playBtn.textContent = evaluation.label;
  playBtn.dataset.invalidReason = evaluation.reason || '';
  // Tooltip native pour mobile/desktop sans toast spam
  playBtn.title = (playBtn.disabled && evaluation.reason) ? evaluation.reason : '';

  // Reset toutes les classes contextuelles
  playBtn.classList.remove('btn--combo', 'btn--combo-incomplete', 'btn--invalid', 'btn--processing');
  if (evaluation.cssClass) {
    playBtn.classList.add(evaluation.cssClass);
  }

  if (endTurnBtn) {
    const isMyTurn = state.turn?.activePlayerUid === humanPlayerUid;
    const mustEndTurn = state.turn?.mustEndTurn;
    endTurnBtn.disabled = !isMyTurn || isProcessing || !!state.activeChain || !!state.nopeWindow;
    if (mustEndTurn) {
      endTurnBtn.textContent = '⚡ FINIR (PIOCHE)';
      endTurnBtn.classList.add('btn--urgent');
    } else {
      endTurnBtn.textContent = '↺ FINIR (PIOCHE)';
      endTurnBtn.classList.remove('btn--urgent');
    }
  }
}

function setupInputs() {
  const handEl = document.getElementById('playerHand');
  const playBtn = document.getElementById('playBtn');
  const endTurnBtn = document.getElementById('endTurnBtn');
  const nopeBtn = document.getElementById('nopeWindowBtn');

  if (handEl) {
    handEl.addEventListener('click', handleHandClick);
    setupDragAndDrop(handEl);
  }

  if (playBtn) {
    playBtn.addEventListener('click', handlePlayClick);
  }

  if (endTurnBtn) endTurnBtn.addEventListener('click', handleEndTurnClick);

  if (nopeBtn) {
    nopeBtn.addEventListener('click', handleHumanNopeClick);
  }
}

/**
 * Click sur la main : sélection.
 * ✅ FIX : ignoré si un drag est en cours (dataset.dragging)
 */
function handleHandClick(e) {
  const handEl = document.getElementById('playerHand');
  // Ignore le click synthétique déclenché par la fin d'un touch-drag
  if (handEl?.dataset.dragging === 'true') return;

  const cardEl = e.target.closest('.game-card--in-hand');
  if (!cardEl) return;

  const code = cardEl.dataset.cardCode;
  const card = getCard(code);
  if (!card) return;

  // Bouclier : info uniquement (il se déplace via drag & drop)
  if (card.type === CARD_TYPES.SHIELD) {
    showToast('🛡 Glisse le Bouclier pour le déplacer dans ta main. Il se joue automatiquement face à un Ghosté.', 'warning', 3000);
    return;
  }

  // Crush : logique combo
  if (card.type === CARD_TYPES.CRUSH) {
    handleCrushSelection(code, card);
    return;
  }

  // Autre carte : sélection simple. Annule combo en cours.
  if (selectedCrushCombo.length > 0) {
    selectedCrushCombo = [];
  }

  if (selectedCardCode === code) {
    selectedCardCode = null;
  } else {
    selectedCardCode = code;
  }

  refreshUI();
}

function handleCrushSelection(code, card) {
  selectedCardCode = null;

  if (selectedCrushCombo.includes(code)) {
    selectedCrushCombo = selectedCrushCombo.filter(c => c !== code);
    refreshUI();
    return;
  }

  if (selectedCrushCombo.length === 0) {
    selectedCrushCombo = [code];
    showToast(`💕 ${card.crushIdentity}. Choisis 1 carte de plus pour combo.`, 'info', 2200);
    refreshUI();
    return;
  }

  const existingNonJoker = selectedCrushCombo
    .map(c => getCard(c))
    .find(c => !c.isJoker);
  const existingIdentity = existingNonJoker?.crushIdentity;

  if (card.isJoker || !existingIdentity || card.crushIdentity === existingIdentity) {
    if (selectedCrushCombo.length >= 3) {
      showToast(`💕 Maximum 3 cartes pour un combo`, 'warning', 1800);
      return;
    }
    selectedCrushCombo.push(code);
    showToast(
      selectedCrushCombo.length === 2
        ? `💕 COMBO ×2 prêt !`
        : `💕💕 COMBO ×3 prêt !`,
      'info',
      2000
    );
  } else {
    selectedCrushCombo = [code];
    showToast(`Reset → ${card.crushIdentity}`, 'info', 1500);
  }

  refreshUI();
}

function setupDragAndDrop(handEl) {
  // ─── HTML5 Drag (desktop) ───────────────────────────────────────────
  handEl.addEventListener('dragstart', (e) => {
    const cardEl = e.target.closest('.game-card--in-hand');
    if (!cardEl) return;
    dragSourceIdx = parseInt(cardEl.dataset.handIndex, 10);
    cardEl.classList.add('game-card--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSourceIdx.toString());
    // ✅ FIX : bloque le re-render de la main pendant le drag
    handEl.dataset.dragging = 'true';
  });

  handEl.addEventListener('dragend', () => {
    handEl.dataset.dragging = 'false';
    dragSourceIdx = null;
    handEl.querySelectorAll('.game-card--dragging, .game-card--drop-before, .game-card--drop-after').forEach(el => {
      el.classList.remove('game-card--dragging', 'game-card--drop-before', 'game-card--drop-after');
    });
  });

  handEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cardEl = e.target.closest('.game-card--in-hand');
    handEl.querySelectorAll('.game-card--drop-before, .game-card--drop-after').forEach(el => {
      el.classList.remove('game-card--drop-before', 'game-card--drop-after');
    });
    if (cardEl && dragSourceIdx !== null) {
      const targetIdx = parseInt(cardEl.dataset.handIndex, 10);
      if (targetIdx !== dragSourceIdx) {
        // Détermine si on insère avant ou après selon la position du curseur
        const rect = cardEl.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (e.clientX < midX) {
          cardEl.classList.add('game-card--drop-before');
        } else {
          cardEl.classList.add('game-card--drop-after');
        }
      }
    }
  });

  handEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const cardEl = e.target.closest('.game-card--in-hand');
    if (!cardEl || dragSourceIdx === null) return;
    let targetIdx = parseInt(cardEl.dataset.handIndex, 10);
    if (isNaN(targetIdx) || targetIdx === dragSourceIdx) return;

    // Ajuste l'index selon avant/après
    const rect = cardEl.getBoundingClientRect();
    const insertAfter = e.clientX >= rect.left + rect.width / 2;
    if (insertAfter && targetIdx < dragSourceIdx) targetIdx += 1;
    if (!insertAfter && targetIdx > dragSourceIdx) targetIdx -= 1;

    const player = state.players[humanPlayerUid];
    const newHand = [...player.hand];
    const [moved] = newHand.splice(dragSourceIdx, 1);
    const finalIdx = Math.max(0, Math.min(targetIdx, newHand.length));
    newHand.splice(finalIdx, 0, moved);

    handEl.dataset.dragging = 'false';
    GameState.reorderHand(state, humanPlayerUid, newHand);
    refreshUI();
  });

  // ─── Touch (mobile) ─────────────────────────────────────────────────
  let touchSourceIdx = null;
  let touchSourceCard = null;
  let touchTimer = null;
  let touchStartY = 0;
  let touchStartX = 0;
  let isDraggingTouch = false;
  let touchDragDone = false;  // ✅ FIX : empêche le click post-touchend

  handEl.addEventListener('touchstart', (e) => {
    const cardEl = e.target.closest('.game-card--in-hand');
    if (!cardEl) return;
    touchSourceIdx = parseInt(cardEl.dataset.handIndex, 10);
    touchSourceCard = cardEl;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDraggingTouch = false;
    touchDragDone = false;

    touchTimer = setTimeout(() => {
      isDraggingTouch = true;
      handEl.dataset.dragging = 'true';
      cardEl.classList.add('game-card--dragging');
      if (navigator.vibrate) navigator.vibrate(20);
    }, 300);
  }, { passive: true });

  handEl.addEventListener('touchmove', (e) => {
    if (!touchSourceCard) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);

    if (!isDraggingTouch && (dx > 8 || dy > 8)) {
      clearTimeout(touchTimer);
      touchSourceCard = null;
      touchSourceIdx = null;
      return;
    }
    if (isDraggingTouch) {
      e.preventDefault();
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const elementBelow = document.elementFromPoint(x, y);
      const cardBelow = elementBelow?.closest('.game-card--in-hand');
      handEl.querySelectorAll('.game-card--drop-before, .game-card--drop-after').forEach(el => {
        el.classList.remove('game-card--drop-before', 'game-card--drop-after');
      });
      if (cardBelow && cardBelow !== touchSourceCard) {
        const rect = cardBelow.getBoundingClientRect();
        if (x < rect.left + rect.width / 2) {
          cardBelow.classList.add('game-card--drop-before');
        } else {
          cardBelow.classList.add('game-card--drop-after');
        }
      }
    }
  }, { passive: false });

  handEl.addEventListener('touchend', (e) => {
    clearTimeout(touchTimer);
    if (!touchSourceCard) return;

    if (isDraggingTouch) {
      // ✅ Empêche le click de se déclencher après un drag
      e.preventDefault();
      touchDragDone = true;

      const x = e.changedTouches[0].clientX;
      const y = e.changedTouches[0].clientY;
      const elementBelow = document.elementFromPoint(x, y);
      const targetCard = elementBelow?.closest('.game-card--in-hand');

      if (targetCard && targetCard !== touchSourceCard) {
        const targetIdx = parseInt(targetCard.dataset.handIndex, 10);
        if (!isNaN(targetIdx) && targetIdx !== touchSourceIdx) {
          const player = state.players[humanPlayerUid];
          const newHand = [...player.hand];
          // INSERT : retire la carte et l'insère à la bonne position
          const rect = targetCard.getBoundingClientRect();
          const insertAfter = e.changedTouches[0].clientX >= rect.left + rect.width / 2;
          const [moved] = newHand.splice(touchSourceIdx, 1);
          let finalIdx = targetIdx;
          if (insertAfter) finalIdx = targetIdx > touchSourceIdx ? targetIdx - 1 : targetIdx;
          else finalIdx = targetIdx > touchSourceIdx ? targetIdx - 1 : targetIdx;
          newHand.splice(Math.max(0, Math.min(finalIdx, newHand.length)), 0, moved);
          handEl.dataset.dragging = 'false';
          GameState.reorderHand(state, humanPlayerUid, newHand);
          refreshUI();
        }
      }
      touchSourceCard.classList.remove('game-card--dragging');
      handEl.dataset.dragging = 'false';
    }

    handEl.querySelectorAll('.game-card--drop-before, .game-card--drop-after').forEach(el =>
      el.classList.remove('game-card--drop-before', 'game-card--drop-after')
    );
    touchSourceCard = null;
    touchSourceIdx = null;
    isDraggingTouch = false;
  });
}  // ← fin setupDragAndDrop

async function handlePlayClick() {
  if (isProcessing) {
    showToast('⏳ Action en cours...', 'info', 1200);
    return;
  }
  isProcessing = true;
  updatePlayButton();

  try {
    if (selectedCrushCombo.length >= 2) {
      await playCrushCombo();
      return;
    }

    if (!selectedCardCode) {
      isProcessing = false;
      return;
    }

    await playSelectedCard();
  } catch (err) {
    console.error('Erreur Play:', err);
    showToast('Une erreur est survenue', 'error');
    isProcessing = false;
    refreshUI();
  }
}

/**
 * Exécute une action avec gestion automatique de la fenêtre Nope.
 *
 * Si l'action est nopeable :
 *   1. Joue l'animation
 *   2. Ouvre la fenêtre Nope (5s)
 *   3. Affiche le banner avec timer
 *   4. Demande aux bots adverses s'ils Nope
 *   5. Si humain peut Nope, attend son input ou expiration
 *   6. À la fermeture : applique l'action OU l'annule (selon parité chaîne)
 *
 * Sinon : applique direct.
 *
 * @returns {Promise<{success, result?, canceled?}>}
 */
async function executeWithNopeWindow(sourceUid, cardCode, options = {}) {
  const card = getCard(cardCode);
  if (!card) return { success: false };

  const nopeable = isNopeable(card, { sourceUid, targetUid: options.targetUid });

  // Si pas nopeable → exécution directe
  if (!nopeable) {
    const result = GameState.playCard(state, sourceUid, cardCode, options);
    return { success: result.success, result, canceled: false };
  }

  // ========= Action nopeable =========
  // Snapshot des paramètres pour pouvoir rejouer après la fenêtre
  const actionDescriptor = buildActionDescriptor(sourceUid, cardCode, options);

  // 1. Animation
  await animateCardPlay(card, options.targetUid, sourceUid);

  // 2. Ouvre la fenêtre
  GameState.openNopeWindow(state, sourceUid, actionDescriptor);
  refreshUI();
  showNopeBannerUI();

  // 3. Bots évaluent leur Nope (avec délai aléatoire 0.4-2.5s)
  const botsWhoMightNope = state.nopeWindow.openTo.filter(uid => state.players[uid].isBot);
  for (const botUid of botsWhoMightNope) {
    scheduleBotNopeEvaluation(botUid, actionDescriptor);
  }

  // 4. Attendre la fin de la fenêtre (5s ou contre-Nope)
  await waitNopeWindowToClose();

  // 5. Récupère le résultat
  hideNopeBannerUI();
  const closeResult = GameState.closeNopeWindow(state);

  if (closeResult.canceled) {
    // ⚠️ La carte attaquante doit être DÉFAUSSÉE (consommée même si annulée)
    const sourcePlayer = state.players[sourceUid];
    if (sourcePlayer) {
      const handIdx = sourcePlayer.hand.indexOf(cardCode);
      if (handIdx !== -1) {
        sourcePlayer.hand.splice(handIdx, 1);
        sourcePlayer.handVersion = (sourcePlayer.handVersion || 0) + 1;
      }
      // Et combo Crush : retire toutes les cartes du combo
      if (options.crushCombo && Array.isArray(options.crushCombo)) {
        for (const comboCode of options.crushCombo) {
          const idx = sourcePlayer.hand.indexOf(comboCode);
          if (idx !== -1) sourcePlayer.hand.splice(idx, 1);
        }
        sourcePlayer.handVersion = (sourcePlayer.handVersion || 0) + 1;
      }
      // Défausse la carte (pas le combo entier qui aurait été défaussé par playCard)
      const codesToDiscard = options.crushCombo || [cardCode];
      for (const c of codesToDiscard) {
        state.deck.discardPile = state.deck.discardPile.concat([{
          code: c,
          playedBy: sourceUid,
          discardedAt: Date.now(),
          canceledByNope: true,
        }]);
      }
    }
    showEpicEffect('nope', {
      icon: '🚫',
      title: 'NOPE !',
      subtitle: 'Action annulée',
    });
    shakeScreen('medium');
    refreshUI();
    return { success: false, canceled: true };
  }

  // 6. L'action passe : on l'applique pour de vrai maintenant
  const result = GameState.playCard(state, sourceUid, cardCode, options);
  return { success: result.success, result, canceled: false };
}

/**
 * Programme une évaluation du bot pour la fenêtre Nope ouverte.
 * Le bot peut décider de jouer un Nope avec un délai humain réaliste.
 */
function scheduleBotNopeEvaluation(botUid, actionDescriptor) {
  // Délai avant de "réfléchir" : 0.4 à 2.5s
  const delay = 400 + Math.random() * 2100;
  sessionTimeout(() => {
    if (!state || !state.nopeWindow) return; // Fenêtre déjà fermée ou partie quittée
    if (!state.nopeWindow.openTo.includes(botUid)) return; // Plus autorisé
    const nopeCard = Bot.decideBotNopeResponse(state, botUid, actionDescriptor);
    if (nopeCard) {
      const result = GameState.playNope(state, botUid, nopeCard);
      if (result.success) {
        showToast(`🚫 ${state.players[botUid].nickname} joue NOPE !`, 'critical', 2500);
        refreshUI();
        // Ré-évalue les autres bots qui peuvent contre-Nope (incluant l'auteur original)
        const counterCandidates = state.nopeWindow.openTo.filter(uid => state.players[uid].isBot);
        for (const counterUid of counterCandidates) {
          scheduleBotCounterNope(counterUid, actionDescriptor);
        }
      }
    }
  }, delay);
}

/**
 * Bot qui décide de contre-Nope (chaîne en cours, timer de 5s partagé).
 * ✅ RÈGLE : les bots attendent la fin du timer ou la fin de la chaîne avant de jouer.
 * Si le bot choisit de ne pas Nope → aucune action : la fenêtre se fermera à expiresAt.
 */
function scheduleBotCounterNope(botUid, actionDescriptor) {
  const delay = 800 + Math.random() * 2000;
  sessionTimeout(() => {
    if (!state || !state.nopeWindow) return;
    if (!state.nopeWindow.openTo.includes(botUid)) return;
    const nopeCard = Bot.decideBotNopeResponse(state, botUid, actionDescriptor);
    if (nopeCard) {
      const result = GameState.playNope(state, botUid, nopeCard);
      if (result.success) {
        showToast(`🚫 ${state.players[botUid].nickname} contre avec un NOPE !`, 'critical', 2500);
        refreshUI();
        // Re-évalue les autres bots éligibles pour contre-Nope
        const counterCandidates = state.nopeWindow.openTo.filter(uid => state.players[uid]?.isBot);
        for (const counterUid of counterCandidates) {
          scheduleBotCounterNope(counterUid, actionDescriptor);
        }
      }
    }
    // Si le bot ne Nope pas : on ne fait rien, la fenêtre expire naturellement à expiresAt.
  }, delay);
}

/**
 * Attend la fermeture naturelle de la fenêtre Nope.
 *
 * ✅ RÈGLE : personne ne peut rien faire pendant ce temps (isProcessing = true).
 * La fenêtre se ferme quand :
 *   (a) expiresAt est atteint (timer 5s initial, ou 5s après chaque Nope)
 *   (b) La session change (joueur a quitté)
 */
async function waitNopeWindowToClose() {
  return new Promise((resolve) => {
    const sessionAtStart = gameSessionId;

    const checkInterval = setInterval(() => {
      if (sessionAtStart !== gameSessionId || !state) {
        clearInterval(checkInterval);
        clearInterval(uiInterval);
        resolve();
        return;
      }
      // Fenêtre fermée manuellement (passNopeCounter)
      if (!state.nopeWindow) {
        clearInterval(checkInterval);
        clearInterval(uiInterval);
        resolve();
        return;
      }
      // Timer expiré
      if (Date.now() >= state.nopeWindow.expiresAt) {
        clearInterval(checkInterval);
        clearInterval(uiInterval);
        resolve();
      }
    }, 80);

    activeIntervals.add(checkInterval);

    // Rafraîchit le timer UI toutes les 80ms
    const uiInterval = setInterval(() => {
      if (sessionAtStart !== gameSessionId || !state || !state.nopeWindow) {
        clearInterval(uiInterval);
        return;
      }
      updateNopeBannerUI();
    }, 80);
    activeIntervals.add(uiInterval);
  });
}

/**
 * Affiche le banner Nope.
 */
function showNopeBannerUI() {
  const banner = document.getElementById('nopeWindowBanner');
  if (!banner) return;
  const action = state.nopeWindow?.actionDescriptor;
  const card = getCard(action?.cardCode);
  const sourceName = state.players[action?.sourcePlayerUid]?.nickname || '?';
  const targetName = action?.targetUid ? state.players[action.targetUid]?.nickname : null;

  document.getElementById('nopeWindowAction').textContent =
    `${sourceName} joue "${card?.name || '?'}"${targetName ? ` sur ${targetName}` : ''}`;

  banner.classList.add('nope-window-banner--open');
  updateNopeBannerUI();

  // Active/désactive le bouton selon que le joueur peut Nope ou pas
  const btn = document.getElementById('nopeWindowBtn');
  if (btn) {
    const canNope = state.nopeWindow?.openTo.includes(humanPlayerUid) &&
                    state.players[humanPlayerUid].hand.some(c => getCard(c)?.type === CARD_TYPES.NOPE);
    btn.disabled = !canNope;
    btn.textContent = canNope ? '🚫 JOUER NOPE' : '⏳ EN ATTENTE';
  }
}

/**
 * Met à jour le timer du banner Nope.
 * ✅ RÈGLE : timer compte toujours à rebours (5s initial, 5s par contre-Nope).
 */
function updateNopeBannerUI() {
  const win = state.nopeWindow;
  if (!win) return;

  const timerEl = document.getElementById('nopeWindowTimer');
  const fillEl = document.getElementById('nopeWindowTimerFill');
  const chainEl = document.getElementById('nopeWindowChain');
  const btn = document.getElementById('nopeWindowBtn');

  const remaining = Math.max(0, win.expiresAt - Date.now());
  const seconds = (remaining / 1000).toFixed(1);
  if (timerEl) timerEl.textContent = `${seconds}s`;
  if (fillEl) {
    const pct = (remaining / GAME_CONFIG.NOPE_RESPONSE_WINDOW_MS) * 100;
    fillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  if (chainEl) {
    if (win.nopeChain.length === 0) {
      chainEl.textContent = '';
    } else {
      const lastNoper = win.nopeChain[win.nopeChain.length - 1];
      const nopeName = state.players[lastNoper.playerUid]?.nickname || '?';
      const isCanceled = win.nopeChain.length % 2 === 1;
      chainEl.textContent = `${win.nopeChain.length} Nope${win.nopeChain.length > 1 ? 's' : ''} — ${isCanceled ? '❌ ANNULÉ' : '✅ RÉACTIVÉ'} (dernier: ${nopeName})`;
    }
  }

  // Re-check si le joueur peut Nope
  if (btn) {
    const canNope = win.openTo.includes(humanPlayerUid) &&
                    state.players[humanPlayerUid]?.hand.some(c => getCard(c)?.type === CARD_TYPES.NOPE);
    btn.disabled = !canNope;
    btn.textContent = canNope ? '🚫 JOUER NOPE' : '⏳ EN ATTENTE';
  }
}

/**
 * Cache le banner Nope.
 */
function hideNopeBannerUI() {
  const banner = document.getElementById('nopeWindowBanner');
  if (banner) banner.classList.remove('nope-window-banner--open');
}

async function playSelectedCard() {
  const card = getCard(selectedCardCode);
  if (!card) { isProcessing = false; return; }

  let targetUid = null;
  if (card.target === 'choice' || card.target === 'self_or_choice') {
    // ✅ FIX: une conditionnelle qui évalue à valeur positive → permet de se cibler soi-même
    let allowSelf = card.target === 'self_or_choice';
    if (!allowSelf && card.type === CARD_TYPES.CONDITIONAL) {
      const activeTraits = (state.crush?.revealedTraits || [])
        .filter(t => t.isActive)
        .map(t => getTrait ? getTrait(t.traitId) : null)
        .filter(Boolean);
      const evalResult = evaluateConditionalCard(card, activeTraits);
      if (evalResult.value > 0) allowSelf = true;
    }
    targetUid = await showTargetPicker(state, humanPlayerUid, {
      title: getTargetPickerTitle(card),
      allowSelf,
      cardCode: card.code,
    });
    if (!targetUid) {
      isProcessing = false;
      updatePlayButton();
      return;
    }
  }

  // Passe par le flow Nope window
  const exec = await executeWithNopeWindow(humanPlayerUid, selectedCardCode, { targetUid });

  if (exec.canceled) {
    selectedCardCode = null;
    isProcessing = false;
    refreshUI();
    return;
  }

  const result = exec.result;
  if (!result || !result.success) {
    showToast(result?.error || 'Action impossible', 'error');
    isProcessing = false;
    updatePlayButton();
    return;
  }

  // === EFFETS ÉPIQUES (au lieu des simples toasts) ===
  const flagEffect = result.effects?.find(e => e.type === 'flag_placed');
  if (flagEffect) {
    const cardEntity = getCard(cardCode);
    const isGreen = flagEffect.flagType === 'green';
    const targetUid = flagEffect.targetUid;

    // Impact sur le portrait du joueur cible
    impactPlayer(targetUid, isGreen ? 'green' : 'red');

    // Animation de la jauge avec delta
    if (flagEffect.gaugeDelta !== undefined && flagEffect.gaugeDelta !== 0) {
      // On laisse le DOM se rendre avec la nouvelle jauge avant d'animer
      requestAnimationFrame(() => {
        animateGaugeChange(targetUid, flagEffect.gaugeDelta, flagEffect.newGauge);
      });
    }

    // Effet épique pour critiques
    if (flagEffect.isDoubleCritical) {
      showEpicEffect('double_critical', {
        icon: isGreen ? '💚✨' : '💔💥',
        title: 'DOUBLE CRITIQUE',
        value: `${flagEffect.gaugeDelta > 0 ? '+' : ''}${flagEffect.gaugeDelta}%`,
        subtitle: isGreen ? 'Le Crush adore !' : 'Le Crush déteste !',
      });
    } else if (flagEffect.isCritical) {
      showEpicEffect('critical', {
        icon: isGreen ? '💚' : '💔',
        title: 'CRITIQUE',
        value: `${flagEffect.gaugeDelta > 0 ? '+' : ''}${flagEffect.gaugeDelta}%`,
      });
    }

    // Shake léger sur Red Flag
    if (!isGreen) shakeScreen('light');
  }

  // Toast Table Rase
  const rase = result.effects?.find(e => e.type === 'table_rase');
  if (rase) {
    const target = state.players[rase.targetUid];
    showToast(`🧹 Table Rase ! ${target.nickname} : ${rase.flagsRemoved} flags effacés`, 'critical', 2800);
  }

  // Cartes Exploding Kittens : résolution UI
  await handlePendingResolutions();

  selectedCardCode = null;
  refreshUI();

  if (state.activeChain) {
    isProcessing = false;
    refreshUI();
    await sleep(900);
    handleChainContinuation();
    return;
  }

  if (result.gameEnded) {
    handleGameEnd();
    return;
  }

  if (result.mustEndTurn) {
    // Plus utilisé pour les Red Flags, mais peut être déclenché par d'autres effets
    isProcessing = false;
    refreshUI();
    return;
  }

  isProcessing = false;
  refreshUI();
}

function getTargetPickerTitle(card) {
  if (card.actionEffect === 'table_rase') return `🧹 Sur qui faire Table Rase ?`;
  if (card.value > 0) return `À qui poser "${card.name}" ?`;
  return `Sur qui jouer "${card.name}" ?`;
}

async function playCrushCombo() {
  const comboCards = [...selectedCrushCombo];
  const firstCard = getCard(comboCards[0]);

  // Passe par le flow Nope window
  const exec = await executeWithNopeWindow(humanPlayerUid, comboCards[0], { crushCombo: comboCards });

  if (exec.canceled) {
    selectedCrushCombo = [];
    isProcessing = false;
    refreshUI();
    return;
  }

  const result = exec.result;
  if (!result || !result.success) {
    showToast(result?.error || 'Combo invalide', 'error');
    selectedCrushCombo = [];
    isProcessing = false;
    refreshUI();
    return;
  }

  selectedCrushCombo = [];
  refreshUI();

  showEpicEffect('combo_steal', {
    icon: '💕',
    title: `COMBO ×${result.comboLevel}`,
    subtitle: result.comboLevel === 3 ? 'Vol précis activé' : 'Vol au hasard activé',
  });

  if (result.pendingCombo) {
    await sleep(1200);
    await handleHumanCrushCombo(result.pendingCombo.level);
  }

  isProcessing = false;
  refreshUI();
}

/**
 * Résout les actions en attente après le jeu d'une carte (humain).
 */
async function handlePendingResolutions() {
  // 👀 Peek dernière carte (DRAW_FROM_BOTTOM) — joueur décide de prendre ou non
  if (state.pendingPeekBottom && state.pendingPeekBottom.playerUid === humanPlayerUid) {
    const { cardCode } = state.pendingPeekBottom;
    const take = await showPeekBottom(cardCode, getCard);
    const peekResult = GameState.resolvePeekBottom(state, humanPlayerUid, take);
    if (peekResult.took && !peekResult.drawnGhosted) {
      const c = getCard(peekResult.cardCode);
      showToast(`✋ Tu as pris "${c?.name || '?'}" du fond du deck !`, 'info', 2500);
    } else if (peekResult.took && peekResult.drawnGhosted) {
      await handleHumanGhosted();
    } else {
      showToast('❌ Carte laissée en bas du deck.', 'info', 2000);
    }
    refreshUI();
  }

  // 👁️ Stalker (PEEK_DECK) : affiche les 3 prochaines cartes (privé)
  if (state.pendingPeekDeck && state.pendingPeekDeck.playerUid === humanPlayerUid) {
    const cards = state.pendingPeekDeck.cards;
    state.pendingPeekDeck = null;
    if (cards?.length) {
      showToast(`👁️ Tu vois les ${cards.length} prochaines cartes !`, 'info', 2500);
      await sleep(500);
      await showDivinationPublic(cards, getCard);
    }
  }

  // 🔍 Enquête Insta (PEEK_HAND) : affiche la main de la cible
  if (state.pendingPeekHand && state.pendingPeekHand.viewerUid === humanPlayerUid) {
    const { targetUid, cards } = state.pendingPeekHand;
    state.pendingPeekHand = null;
    const targetName = state.players[targetUid]?.nickname || '?';
    if (cards?.length) {
      showToast(`🔍 Tu fouilles la main de ${targetName}…`, 'info', 2000);
      await sleep(400);
      await showDivinationPublic(cards, getCard);
    }
  }

  // Mélanger
  if (state.pendingShuffle && state.pendingShuffle.playerUid === humanPlayerUid) {
    const drawPile = state.deck.drawPile;
    if (drawPile.length < 2) {
      showToast('Pas assez de cartes pour Mélanger !', 'warning', 2000);
      state.pendingShuffle = null;
    } else {
      // Affiche les cartes du deck pour choisir top + bottom
      // Pour des raisons d'UX, on affiche maximum 12 cartes sinon c'est ingérable
      const visibleCards = drawPile.slice(-Math.min(12, drawPile.length)).reverse();
      const choice = await showShufflePicker(visibleCards, getCard);
      if (choice) {
        const r = GameState.resolveShuffleChoice(state, humanPlayerUid, choice.topCard, choice.bottomCard);
        if (r.success) {
          showToast(`🔀 Deck mélangé selon ton choix`, 'info', 2200);
        }
      } else {
        state.pendingShuffle = null;
      }
    }
  }

  // Faveur — c'est l'adversaire qui choisit
  if (state.pendingFavor) {
    const targetUid = state.pendingFavor.targetUid;
    const requesterUid = state.pendingFavor.requesterUid;
    if (targetUid === humanPlayerUid) {
      // L'humain est le donneur
      const requester = state.players[requesterUid];
      const me = state.players[humanPlayerUid];
      if (me.hand.length === 0) {
        state.pendingFavor = null;
      } else {
        const givenCode = await showFavorDonor(me, requester.nickname, getCard);
        if (givenCode) {
          GameState.resolveFavor(state, humanPlayerUid, givenCode);
          const c = getCard(givenCode);
          showToast(`🙏 Tu as donné "${c?.name || '?'}" à ${requester.nickname}`, 'info', 2200);
        } else {
          state.pendingFavor = null;
        }
      }
    } else if (requesterUid === humanPlayerUid) {
      // L'humain est le demandeur, le bot/joueur cible va donner
      // Si la cible est un bot, on auto-résout
      const target = state.players[targetUid];
      if (target.isBot) {
        const givenCode = botChooseFavorCard(target);
        if (givenCode) {
          GameState.resolveFavor(state, targetUid, givenCode);
          const c = getCard(givenCode);
          showToast(`🙏 ${target.nickname} t'a donné "${c?.name || '?'}"`, 'info', 2200);
        } else {
          state.pendingFavor = null;
        }
      }
      // Sinon en multi humain ce sera géré par l'autre client
    }
  }

  // Changer l'avenir
  if (state.pendingAlterFuture && state.pendingAlterFuture.playerUid === humanPlayerUid) {
    const cards = state.pendingAlterFuture.cards;
    const newOrder = await showAlterFutureReorder(cards, getCard);
    if (newOrder) {
      GameState.resolveAlterFuture(state, humanPlayerUid, newOrder);
      showToast(`✨ Tu as réorganisé l'avenir`, 'info', 2200);
    } else {
      state.pendingAlterFuture = null;
    }
  }

  // Divination publique : affiche le dialog 8s
  if (state.publicReveal) {
    await showDivinationPublic(state.publicReveal.cards, getCard);
    state.publicReveal = null;
  }
}

/**
 * Résout les actions en attente du bot.
 */
async function handleBotPendingResolutions(botUid) {
  // Mélanger : bot prend la 1ère et la dernière au hasard
  if (state.pendingShuffle && state.pendingShuffle.playerUid === botUid) {
    const drawPile = state.deck.drawPile;
    if (drawPile.length >= 2) {
      // Bot stratégique : top = la moins dangereuse (pas un Ghosté), bottom = un Ghosté si possible
      const ghostedIdx = drawPile.findIndex(c => c === 'GHOSTED');
      let bottomChoice, topChoice;
      if (ghostedIdx !== -1 && drawPile.length > 2) {
        bottomChoice = 'GHOSTED';
        topChoice = drawPile.find(c => c !== 'GHOSTED');
      } else {
        topChoice = drawPile[drawPile.length - 1];
        bottomChoice = drawPile[0];
      }
      if (topChoice && bottomChoice && topChoice !== bottomChoice) {
        GameState.resolveShuffleChoice(state, botUid, topChoice, bottomChoice);
        showToast(`🔀 ${state.players[botUid].nickname} a mélangé le deck`, 'info', 2000);
      } else {
        state.pendingShuffle = null;
      }
    } else {
      state.pendingShuffle = null;
    }
  }

  // Faveur — résolution si la cible est un bot (appelé depuis le tour humain)
  if (state.pendingFavor) {
    const targetUid = state.pendingFavor.targetUid;
    const requesterUid = state.pendingFavor.requesterUid;
    const target = state.players[targetUid];
    const requester = state.players[requesterUid];

    if (target?.isBot) {
      // Bot donne une carte à l'humain
      const givenCode = botChooseFavorCard(target);
      if (givenCode) {
        GameState.resolveFavor(state, targetUid, givenCode);
        const c = getCard(givenCode);
        showToast(`🙏 ${target.nickname} t'a donné "${c?.name || '?'}"`, 'info', 2200);
        refreshUI();
      } else {
        state.pendingFavor = null;
      }
    } else if (targetUid === humanPlayerUid) {
      // L'humain doit donner une carte
      const me = state.players[humanPlayerUid];
      if (me.hand.length === 0) {
        state.pendingFavor = null;
      } else {
        showToast(`🙏 ${requester?.nickname || '?'} te demande une carte !`, 'warning', 2500);
        await sleep(600);
        const givenCode = await showFavorDonor(me, requester?.nickname || '?', getCard);
        if (givenCode) {
          GameState.resolveFavor(state, humanPlayerUid, givenCode);
          const c = getCard(givenCode);
          showToast(`Tu as donné "${c?.name || '?'}"`, 'info', 2000);
        } else {
          // Refus → donne au hasard
          const randomCode = me.hand[Math.floor(Math.random() * me.hand.length)];
          GameState.resolveFavor(state, humanPlayerUid, randomCode);
        }
        refreshUI();
      }
    }
  }

  // Changer l'avenir : bot garde l'ordre tel quel
  if (state.pendingAlterFuture && state.pendingAlterFuture.playerUid === botUid) {
    const cards = state.pendingAlterFuture.cards;
    // Stratégie simple : si Ghosté en 1ère pos, le bot le déplace en dernier
    let newOrder = [...cards];
    if (newOrder[0] === 'GHOSTED') {
      newOrder.push(newOrder.shift());
    }
    GameState.resolveAlterFuture(state, botUid, newOrder);
    showToast(`✨ ${state.players[botUid].nickname} a manipulé le deck`, 'info', 2000);
  }

  // Divination : aussi visible pour tous
  if (state.publicReveal) {
    await showDivinationPublic(state.publicReveal.cards, getCard);
    state.publicReveal = null;
  }
}

/**
 * Stratégie du bot pour donner une carte (Faveur) : la "moins utile" en priorité.
 */
function botChooseFavorCard(bot) {
  if (bot.hand.length === 0) return null;
  // Préférence : conditional non remplie > Crush isolé > Action peu utile > au hasard
  const cards = bot.hand.map(c => ({ code: c, card: getCard(c) })).filter(c => c.card);
  // Trie par "moins utile" : Conditional puis Action sans cible utile
  const ordered = [...cards].sort((a, b) => {
    const score = (c) => {
      if (c.card.type === CARD_TYPES.CONDITIONAL) return 1;
      if (c.card.type === CARD_TYPES.CRUSH) return 2;
      if (c.card.type === CARD_TYPES.ACTION) return 3;
      if (c.card.type === CARD_TYPES.GREEN_FLAG) return 5;
      if (c.card.type === CARD_TYPES.RED_FLAG) return 5;
      if (c.card.type === CARD_TYPES.NOPE) return 10;
      return 4;
    };
    return score(a) - score(b);
  });
  return ordered[0]?.code || null;
}

async function handleHumanCrushCombo(level) {
  if (level === 2) {
    const targetUid = await showTargetPicker(state, humanPlayerUid, {
      title: '👀 COMBO ×2 — Vol au hasard',
      subtitle: 'Choisis ta victime',
      allowSelf: false,
    });
    if (!targetUid) {
      state.pendingCrushCombo = null;
      return;
    }

    const target = state.players[targetUid];
    const handIndex = await showStealHandPicker(target);
    if (handIndex === null) {
      state.pendingCrushCombo = null;
      return;
    }

    const result = GameState.resolveCrushComboSteal(state, humanPlayerUid, targetUid, handIndex);
    if (result.success) {
      const stolen = getCard(result.stolenCardCode);
      showToast(`🎁 Tu as volé "${stolen?.name || '?'}" !`, 'critical', 3000);
    }
  } else if (level === 3) {
    const targetUid = await showTargetPicker(state, humanPlayerUid, {
      title: '🔍 COMBO ×3 — Demande précise',
      subtitle: 'Choisis qui interroger',
      allowSelf: false,
    });
    if (!targetUid) {
      state.pendingCrushCombo = null;
      return;
    }

    const requested = await showCardRequestPicker();
    if (!requested) {
      state.pendingCrushCombo = null;
      return;
    }

    const result = GameState.resolveCrushComboRequest(state, humanPlayerUid, targetUid, requested);
    if (result.type === 'crush_combo_request_success') {
      const c = getCard(requested);
      showToast(`🎯 Touché ! Tu récupères "${c?.name}"`, 'critical', 3000);
    } else {
      showToast(`💨 Raté ! L'adversaire ne l'avait pas.`, 'info', 2500);
    }
  }
}

async function handleEndTurnClick() {
  if (isProcessing) return;
  if (state.turn.activePlayerUid !== humanPlayerUid) return;

  selectedCrushCombo = [];
  selectedCardCode = null;

  isProcessing = true;
  await autoEndTurn(null);
  isProcessing = false;
  refreshUI();
  scheduleNextBotIfNeeded();
}

async function autoEndTurn(actionResult) {
  if (actionResult?.skipDraw) {
    GameState.advanceToNextTurn(state);
    refreshUI();
    return;
  }

  const result = GameState.endTurn(state, humanPlayerUid);

  if (result.dangerEliminated) {
    showToast('💀 Tu es éliminé : trop longtemps en danger', 'error', 5000);
    if (result.gameEnded) handleGameEnd();
    return;
  }

  if (result.mustHandleGhosted) {
    // handleHumanGhosted already calls advanceToNextTurn + scheduleNextBotIfNeeded
    await handleHumanGhosted();
    refreshUI();
    return; // do NOT call scheduleNextBotIfNeeded again from caller
  }

  // ✅ FIX : affiche la carte piochée + force re-render immédiat
  const drawn = result.drawResult;
  if (drawn && !drawn.skipped && drawn.drawnCards?.length) {
    const drawnCode = drawn.drawnCards[0];
    const drawnCard = getCard(drawnCode);
    if (drawnCard) {
      showToast(`🃏 Pioche : ${drawnCard.emoji || ''} ${drawnCard.name}`, 'info', 2500);
    }
  } else if (drawn?.deckEmpty) {
    showToast('📭 Le deck est vide !', 'warning', 2500);
  }

  // Re-render immédiat pour que la carte apparaisse
  refreshUI();

  if (result.traitReveal) {
    showToast(`✨ Trait révélé : ${result.traitReveal.traitObject.displayName}`, 'info', 3500);
    if (result.traitReveal.flips.length > 0) {
      await sleep(700);
      showToast(`⚡ ${result.traitReveal.flips.length} flag(s) retourné(s) !`, 'flip', 2800);
    }
  }

  // Élimination par limite de Red Flags
  const elimUid = result.advanceResult?.redFlagElimination ?? state.turn?.redFlagElimination;
  if (elimUid) {
    const elimName = state.players[elimUid]?.nickname || '?';
    showToast(`🚩 ${elimName} éliminé : trop de Red Flags !`, 'error', 4000);
    state.turn.redFlagElimination = null;
  }

  if (result.gameEnded) {
    handleGameEnd();
    return;
  }

  refreshUI();
}

async function handleHumanGhosted() {
  const player = state.players[humanPlayerUid];
  const hasShield = player.hand.some(code => {
    const c = getCard(code);
    return c && c.type === CARD_TYPES.SHIELD;
  }) || player.profile.shieldActive;

  const decision = await showGhostedReveal(state, humanPlayerUid, hasShield);

  let position = null;
  if (decision.useShield) {
    position = await showGhostedReplacement(state.deck.drawPile.length);
    if (position === null) position = 0;
  }

  const result = GameState.handleGhostedDecision(state, humanPlayerUid, decision.useShield, position);

  if (result.gameEnded) {
    handleGameEnd();
    return;
  }

  if (result.ghosted) {
    showEpicEffect('ghosted', {
      icon: '👻',
      title: 'GHOSTÉ',
      subtitle: 'Tu es éliminé...',
    });
    shakeScreen('strong');
  } else if (result.shielded) {
    showEpicEffect('shielded', {
      icon: '🛡️',
      title: 'SAUVÉ !',
      subtitle: 'Bouclier activé',
    });
    impactPlayer(humanPlayerUid, 'shield');
  }

  if (!result.gameEnded) {
    GameState.advanceToNextTurn(state);
    refreshUI();
    scheduleNextBotIfNeeded();
  }
}

async function handleChainContinuation() {
  if (!state.activeChain) return;
  const targetUid = state.activeChain.currentTargetUid;

  if (targetUid === humanPlayerUid) {
    showToast(`⚠ Chaîne sur toi ! Joue 📲 (5s)`, 'warning', 5000);
    await sleep(5000);
    if (state.activeChain && state.activeChain.currentTargetUid === humanPlayerUid) {
      await absorbChainAsHuman();
    }
  } else {
    await handleBotChainResponse(targetUid);
  }
}

async function handleBotChainResponse(botUid) {
  await sleep(1200);
  try {
    const counterCard = Bot.decideBotChainResponse(state, botUid);

    if (counterCard) {
      showToast(`${state.players[botUid].nickname} contre la chaîne !`, 'info', 1800);
      GameState.playCard(state, botUid, counterCard);
      refreshUI();
      await sleep(1200);
      handleChainContinuation();
    } else {
      showToast(`${state.players[botUid].nickname} subit la chaîne...`, 'warning', 1800);
      await sleep(1200);
      await absorbChainAsBot(botUid);
    }
  } catch (err) {
    console.error('Erreur chain bot:', err);
    state.activeChain = null;
    refreshUI();
    scheduleNextBotIfNeeded();
  }
}

async function absorbChainAsBot(botUid) {
  try {
    const chainResult = GameState.absorbChain(state, botUid);
    refreshUI();

    // PC-04 Storm: informer que tout le monde a pioché
    if (chainResult.isAllTarget) {
      showToast('🌪️ Storm ! Tout le monde a pioché 1 carte !', 'warning', 2500);
      await sleep(800);
    }
    // PC-05 selfPenalty: informer l'initiateur qu'il pioche aussi
    if (chainResult.selfPenalty > 0 && chainResult.originPlayerUid) {
      const origName = state.players[chainResult.originPlayerUid]?.nickname || '?';
      showToast(`⚡ ${origName} pioche aussi (Super Like Inverse)`, 'info', 2000);
    }

    let safetyCount = 0;
    while (state.pendingGhosted && safetyCount < 10) {
      const pUid = state.pendingGhosted.playerUid;
      await handleBotGhosted(pUid);
      if (state.status === GAME_STATUS.ENDED) {
        handleGameEnd();
        return;
      }
      refreshUI();
      await sleep(500);
      safetyCount++;
    }
    if (safetyCount >= 10) {
      console.warn('Anti-softlock : trop de Ghostés enchaînés, on force la sortie');
      state.pendingGhosted = null;
    }

    await sleep(800);
    // ✅ FIX : après absorption de chaîne, on avance depuis le joueur ACTIF ORIGINAL
    // (celui qui a lancé la chaîne), pas depuis l'absorbeur.
    // L'absorbeur ne "prend" pas de tour — il réagit seulement.
    GameState.advanceToNextTurn(state);
    refreshUI();
    scheduleNextBotIfNeeded();
  } catch (err) {
    console.error('Erreur absorb chain bot:', err);
    state.activeChain = null;
    state.pendingGhosted = null;
    refreshUI();
    scheduleNextBotIfNeeded();
  }
}

async function absorbChainAsHuman() {
  const chainResult = GameState.absorbChain(state, humanPlayerUid);
  refreshUI();

  if (chainResult.isAllTarget) {
    showToast('🌪️ Storm de Notifs ! Tout le monde a pioché 1 carte !', 'warning', 2800);
    await sleep(600);
  }
  if (chainResult.selfPenalty > 0 && chainResult.originPlayerUid) {
    const origName = state.players[chainResult.originPlayerUid]?.nickname || '?';
    showToast(`⚡ ${origName} pioche aussi (Super Like Inverse) !`, 'info', 2200);
    await sleep(600);
  }

  // Affiche les cartes piochées
  if (chainResult.drawnCards?.length) {
    const nonGhosted = chainResult.drawnCards.filter(c => c !== 'GHOSTED');
    if (nonGhosted.length) {
      const names = nonGhosted.map(c => getCard(c)?.name || c).join(', ');
      showToast(`📲 Tu as pioché : ${names}`, 'info', 2500);
    }
  }

  while (state.pendingGhosted) {
    await handleHumanGhosted();
    if (state.status === GAME_STATUS.ENDED) {
      handleGameEnd();
      return;
    }
  }

  await sleep(700);
  // ✅ FIX : avance depuis le joueur qui avait lancé la chaîne, pas depuis l'humain qui l'a absorbée.
  GameState.advanceToNextTurn(state);
  refreshUI();
  scheduleNextBotIfNeeded();
}

function scheduleNextBotIfNeeded() {
  if (state.status === GAME_STATUS.ENDED) return;
  if (state.turn.activePlayerUid === humanPlayerUid) return;
  // ✅ RÈGLE : fenêtre Nope ouverte → personne ne fait rien (même les bots)
  if (state.nopeWindow) return;
  if (state.activeChain && state.activeChain.currentTargetUid !== humanPlayerUid) return;

  // Capture l'UID actif MAINTENANT (pas au déclenchement du timer)
  const scheduledBotUid = state.turn.activePlayerUid;
  // Vérifie que c'est bien un bot (pas le humain)
  if (scheduledBotUid === humanPlayerUid) return;
  const player = state.players[scheduledBotUid];
  if (!player || !player.isBot) return;

  // Ajuste le délai selon la vitesse de partie
  // fast = bots jouent vite, long = bots prennent leur temps
  const speed = state.config?.gameSpeed || 'normal';
  const speedMultiplier = speed === 'fast' ? 0.5 : speed === 'long' ? 1.5 : 1;
  const baseMin = GAME_CONFIG.BOT_THINK_MS_MIN * speedMultiplier;
  const baseMax = GAME_CONFIG.BOT_THINK_MS_MAX * speedMultiplier;
  const delay = baseMin + Math.random() * (baseMax - baseMin);

  sessionTimeout(() => {
    // Re-vérifie au déclenchement : le tour pourrait avoir changé
    if (!state || state.status === GAME_STATUS.ENDED) return;
    if (state.turn.activePlayerUid !== scheduledBotUid) {
      // Le tour est passé à quelqu'un d'autre → on relance la planification
      scheduleNextBotIfNeeded();
      return;
    }
    // Vérification finale : c'est bien un bot
    const currentPlayer = state.players[scheduledBotUid];
    if (!currentPlayer || !currentPlayer.isBot || currentPlayer.uid === humanPlayerUid) {
      return;
    }
    playBotTurn(scheduledBotUid);
  }, delay);
}

async function playBotTurn(botUid) {
  if (!state || state.status === GAME_STATUS.ENDED) return;
  if (isProcessing) return;

  // Garde-fou ULTIME : si l'UID est celui du humain, on refuse catégoriquement
  if (botUid === humanPlayerUid) {
    console.warn('⚠ Tentative de jouer un tour bot avec l\'UID humain — refusé');
    return;
  }
  const player = state.players[botUid];
  if (!player || !player.isBot) {
    console.warn(`⚠ playBotTurn appelé avec un non-bot: ${botUid}`);
    return;
  }

  isProcessing = true;
  const sessionAtStart = gameSessionId;

  const safetyTimeout = setTimeout(() => {
    if (sessionAtStart !== gameSessionId) return; // session changée
    console.warn(`⚠ Bot ${botUid} timeout — force fin de tour`);
    isProcessing = false;
    try {
      GameState.endTurn(state, botUid);
    } catch (e) {
      try { GameState.advanceToNextTurn(state); } catch (e2) {}
    }
    refreshUI();
    scheduleNextBotIfNeeded();
  }, GAME_CONFIG.BOT_TURN_TIMEOUT_MS);

  try {
    await playBotTurnInner(botUid);
  } catch (err) {
    console.error(`❌ Erreur bot ${botUid}:`, err);
    showToast('Le bot a buggé, on continue...', 'warning', 2000);
    try {
      state.activeChain = null;
      state.pendingGhosted = null;
      state.pendingCrushCombo = null;
      state.nopeWindow = null;
      GameState.advanceToNextTurn(state);
    } catch (e2) {
      console.error('Recovery failed:', e2);
    }
  } finally {
    clearTimeout(safetyTimeout);
    isProcessing = false;
    refreshUI();
    if (state.status !== GAME_STATUS.ENDED) {
      scheduleNextBotIfNeeded();
    }
  }
}

async function playBotTurnInner(botUid) {
  // Garde-fou ULTIME : si on n'a plus d'état (partie quittée), on stoppe
  if (!state) return;
  const sessionAtStart = gameSessionId;

  const bot = state.players[botUid];
  if (!bot || bot.isGhosted) return;

  if (state.activeChain && state.activeChain.currentTargetUid === botUid) {
    isProcessing = false;
    handleBotChainResponse(botUid);
    return;
  }

  let actionsCount = 0;

  while (actionsCount < 3 && !state.turn.mustEndTurn && !state.turn.skipDrawForUid) {
    // Si la session a changé entre 2 actions (joueur a quitté), on stoppe
    if (sessionAtStart !== gameSessionId || !state) return;

    const decision = Bot.decideBotAction(state, botUid);

    if (decision.action !== 'play') break;

    const card = getCard(decision.cardCode);
    if (!card) break;

    let exec;
    if (card.type === CARD_TYPES.CRUSH) {
      const sameOrJoker = bot.hand
        .map(c => getCard(c))
        .filter(c => c && c.type === CARD_TYPES.CRUSH &&
                     (c.crushIdentity === card.crushIdentity || c.isJoker));
      // Filtre : doit avoir au moins 1 non-Joker
      const hasNonJoker = sameOrJoker.some(c => !c.isJoker);
      if (sameOrJoker.length < 2 || !hasNonJoker) break;
      const comboCards = sameOrJoker.slice(0, Math.min(3, sameOrJoker.length)).map(c => c.code);
      exec = await executeWithNopeWindow(botUid, comboCards[0], { crushCombo: comboCards });
    } else {
      exec = await executeWithNopeWindow(botUid, decision.cardCode, { targetUid: decision.targetUid });
    }

    if (exec.canceled) {
      // Action annulée par Nope, le bot perd le tour
      showToast(`L'action de ${bot.nickname} a été annulée !`, 'warning', 2200);
      refreshUI();
      await sleep(700);
      break;
    }

    const result = exec.result;
    if (result && result.success) {
      // ✅ BOT FEEDBACK AMÉLIORÉ : message clair avec emoji + effet
      if (card.type === CARD_TYPES.CRUSH) {
        showToast(`💕 ${bot.nickname} déclenche un COMBO ×${result.comboLevel} !`, 'critical', 2800);
      } else if (card.type === CARD_TYPES.GREEN_FLAG) {
        showToast(`🟢 ${bot.nickname} pose un Green Flag (+${card.value}%) sur lui-même`, 'info', 2500);
      } else if (card.type === CARD_TYPES.RED_FLAG) {
        const tgt = decision.targetUid ? state.players[decision.targetUid]?.nickname : '?';
        showToast(`🔴 ${bot.nickname} attaque ${tgt} avec ${card.name} (${card.value}%)`, 'warning', 2500);
      } else if (card.type === CARD_TYPES.CONDITIONAL) {
        const tgt = decision.targetUid ? state.players[decision.targetUid]?.nickname : '?';
        const sign = card.value > 0 ? '+' : '';
        showToast(`🃏 ${bot.nickname} joue "${card.name}" sur ${tgt} (${sign}${card.value}%)`, 'info', 2500);
      } else {
        showToast(`⚡ ${bot.nickname} joue "${card.name}"`, 'info', 2000);
      }

      refreshUI();
      await sleep(600); // pause pour laisser lire le toast

      if (result.pendingCombo) {
        await sleep(900);
        await handleBotCrushCombo(botUid, result.pendingCombo.level);
        refreshUI();
      }

      // Cartes Exploding Kittens : auto-resolve pour les bots
      await handleBotPendingResolutions(botUid);

      const flagEffect = result.effects?.find(e => e.type === 'flag_placed');
      if (flagEffect) {
        const isGreen = flagEffect.flagType === 'green';
        const targetUid = flagEffect.targetUid;
        // Impact sur le portrait
        impactPlayer(targetUid, isGreen ? 'green' : 'red');
        // Animation jauge
        if (flagEffect.gaugeDelta !== undefined && flagEffect.gaugeDelta !== 0) {
          requestAnimationFrame(() => {
            animateGaugeChange(targetUid, flagEffect.gaugeDelta, flagEffect.newGauge);
          });
        }
        // Critique
        if (flagEffect.isCritical) {
          await sleep(300);
          if (flagEffect.isDoubleCritical) {
            showEpicEffect('double_critical', {
              icon: isGreen ? '💚✨' : '💔💥',
              title: 'DOUBLE CRITIQUE',
              value: `${flagEffect.gaugeDelta > 0 ? '+' : ''}${flagEffect.gaugeDelta}%`,
              subtitle: `${bot.nickname} frappe fort !`,
            });
          } else {
            showEpicEffect('critical', {
              icon: isGreen ? '💚' : '💔',
              title: 'CRITIQUE',
              value: `${flagEffect.gaugeDelta > 0 ? '+' : ''}${flagEffect.gaugeDelta}%`,
            });
          }
        }
        if (!isGreen) shakeScreen('light');
      }

      const rase = result.effects?.find(e => e.type === 'table_rase');
      if (rase) {
        await sleep(500);
        const tgt = state.players[rase.targetUid];
        showToast(`🧹 Table Rase sur ${tgt?.nickname || '?'} ! Tous ses flags effacés.`, 'critical', 2800);
      }

      if (state.activeChain) {
        isProcessing = false;
        await sleep(900);
        handleChainContinuation();
        return;
      }

      if (result.gameEnded) {
        handleGameEnd();
        return;
      }

      if (result.mustEndTurn) break;

      actionsCount++;
      await sleep(1800); // pause lisible entre les actions du bot
    } else {
      break;
    }
  }

  await sleep(1100);
  const endResult = GameState.endTurn(state, botUid);

  if (endResult.dangerEliminated) {
    showToast(`💀 ${bot.nickname} éliminé : trop longtemps en danger !`, 'error', 4000);
    if (endResult.gameEnded) {
      handleGameEnd();
      return;
    }
  }

  if (endResult.mustHandleGhosted) {
    await handleBotGhosted(botUid);
    while (state.pendingGhosted) {
      await handleBotGhosted(state.pendingGhosted.playerUid);
      if (state.status === GAME_STATUS.ENDED) {
        handleGameEnd();
        return;
      }
    }
    GameState.advanceToNextTurn(state);
  }

  if (endResult.traitReveal) {
    showToast(`✨ Trait : ${endResult.traitReveal.traitObject.displayName}`, 'info', 3500);
    if (endResult.traitReveal.flips.length > 0) {
      await sleep(600);
      showToast(`⚡ ${endResult.traitReveal.flips.length} flag(s) retourné(s) !`, 'flip', 2800);
    }
  }

  if (endResult.gameEnded) {
    handleGameEnd();
    return;
  }

  refreshUI();
}

async function handleBotCrushCombo(botUid, level) {
  const bot = state.players[botUid];

  if (level === 2) {
    const targetUid = Bot.decideBotComboTarget(state, botUid);
    if (targetUid) {
      const result = GameState.resolveCrushComboSteal(state, botUid, targetUid);
      if (result.success) {
        showToast(`💕 ${bot.nickname} a volé une carte à ${state.players[targetUid].nickname} !`, 'critical', 2800);
      }
    } else {
      state.pendingCrushCombo = null;
    }
  } else if (level === 3) {
    const decision = Bot.decideBotComboRequest(state, botUid);
    if (decision) {
      const result = GameState.resolveCrushComboRequest(
        state, botUid, decision.targetUid, decision.requestedCardCode
      );
      const targetName = state.players[decision.targetUid].nickname;
      if (result.type === 'crush_combo_request_success') {
        showToast(`💕💕 ${bot.nickname} récupère une carte de ${targetName} !`, 'critical', 2800);
      } else {
        showToast(`💨 ${bot.nickname} a tenté un combo ×3 sur ${targetName}... raté !`, 'info', 2800);
      }
    } else {
      state.pendingCrushCombo = null;
    }
  }
}

async function handleBotGhosted(botUid) {
  const useShield = Bot.decideBotShieldUse(state, botUid);
  let position = null;

  if (useShield) {
    position = Bot.decideBotGhostedReplacement(state.deck.drawPile.length);
    if (position === null || isNaN(position)) position = 0;
  }

  const result = GameState.handleGhostedDecision(state, botUid, useShield, position);
  const bot = state.players[botUid];

  if (result.ghosted) {
    showEpicEffect('ghosted', {
      icon: '👻',
      title: 'GHOSTÉ',
      subtitle: `${bot.nickname} est éliminé`,
    });
    shakeScreen('strong');
  } else if (result.shielded) {
    showEpicEffect('shielded', {
      icon: '🛡️',
      title: 'SAUVÉ !',
      subtitle: `${bot.nickname} se protège`,
    });
    impactPlayer(botUid, 'shield');
  }

  refreshUI();
  await sleep(700);
}

/**
 * Click sur le bouton Nope dans la fenêtre.
 */
async function handleHumanNopeClick() {
  // Trouve une carte Nope en main
  const player = state.players[humanPlayerUid];
  const nopeCode = player.hand.find(code => {
    const c = getCard(code);
    return c && c.type === CARD_TYPES.NOPE;
  });
  if (!nopeCode) {
    showToast('Tu n\'as pas de Nope en main', 'error');
    return;
  }
  const result = GameState.playNope(state, humanPlayerUid, nopeCode);
  if (result.success) {
    showToast(`🚫 NOPE × ${result.nopeCount} !`, 'critical', 2200);
    refreshUI();
  }
}

function handleGameEnd() {
  isProcessing = true;
  if (nopeTimerInterval) clearInterval(nopeTimerInterval);

  // === EFFET ÉPIQUE de fin de partie ===
  const winner = state.winner ? state.players[state.winner] : null;
  if (winner) {
    showEpicEffect('victory', {
      icon: '🏆',
      title: 'VICTOIRE',
      subtitle: `${winner.nickname} décroche le date !`,
    });
  } else {
    // Tous Ghostés
    showEpicEffect('ghosted', {
      icon: '👻',
      title: 'TOUS GHOSTÉS',
      subtitle: 'Le Crush a fui...',
    });
  }

  const breakups = Object.values(state.players)
    .filter(p => p.uid !== state.winner)
    .map(p => {
      const sms = generateBreakupSMS(p);
      return { uid: p.uid, nickname: p.nickname, message: sms };
    });

  // Délai pour que l'effet épique soit visible avant la modal
  setTimeout(() => {
    showGameEnd(state, state.winner, breakups);

    // ✅ FIX : câble le bouton Rejouer après que le dialog est injecté dans le DOM
    requestAnimationFrame(() => {
      const replayBtn = document.getElementById('gameoverReplayBtn');
      if (replayBtn) {
        replayBtn.addEventListener('click', () => {
          // Ferme le dialog proprement puis revient au lobby (l'hôte
          // peut relancer une nouvelle partie depuis là)
          endGameSession();
          const dialogEl = document.getElementById('dialogContainer');
          if (dialogEl) {
            dialogEl.classList.remove('dialog-container--open', 'dialog-container--dramatic');
            dialogEl.innerHTML = '';
          }
          window.location.hash = '#/lobby';
        });
      }
    });
  }, 2500);
}

function generateBreakupSMS(player) {
  const allFlags = player.profile.activeFlags || [];
  const reds = allFlags.filter(f => f.type === 'red');
  if (reds.length === 0) {
    return `Hey ${player.nickname}, on matchait pas vraiment. Sorry 🤷`;
  }
  const worstNames = reds.sort((a, b) => a.value - b.value).slice(0, 2).map(f => {
    const c = getCard(f.cardCode);
    return c ? c.name.toLowerCase() : 'tes vibes';
  });
  return `Hey ${player.nickname}, t'étais sympa mais ${worstNames.join(' + ')}... ça le faisait pas 💅`;
}
