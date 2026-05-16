/**
 * RedFlag — Card Animations
 *
 * Animations de cartes : la carte jouée apparaît au centre en grand,
 * puis se réduit en volant vers sa cible.
 */

import { renderCard } from './card-renderer.js';
import { sleep } from '../utils/helpers.js';

let animationContainer = null;

function getContainer() {
  if (!animationContainer) {
    animationContainer = document.createElement('div');
    animationContainer.id = 'cardAnimationLayer';
    animationContainer.className = 'card-animation-layer';
    document.body.appendChild(animationContainer);
  }
  return animationContainer;
}

/**
 * Anime la carte jouée : apparaît au centre, vole vers sa cible.
 *
 * @param {object} card - L'objet carte
 * @param {string} targetUid - UID du joueur ciblé (ou null pour le centre)
 * @param {string} sourceUid - UID du joueur qui joue (pour la position de départ)
 */
export async function animateCardPlay(card, targetUid, sourceUid) {
  if (!card) return;

  const lowEnd = document.body.classList.contains('low-end-mode');
  const container = getContainer();

  // Position de la cible
  let targetEl = null;
  if (targetUid) {
    targetEl = document.querySelector(`[data-player-uid="${targetUid}"]`);
    if (!targetEl && targetUid) {
      targetEl = document.querySelector('.player-board');
    }
  }
  if (!targetEl) {
    targetEl = document.querySelector('.crush-frame');
  }

  // Crée l'élément animé au centre
  const animEl = document.createElement('div');
  animEl.className = 'card-anim';
  if (lowEnd) animEl.classList.add('card-anim--simple');
  animEl.innerHTML = renderCard(card.code, { activeTraits: [], inHand: false });
  container.appendChild(animEl);

  // Force le reflow
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Phase 1 : apparition au centre, agrandi
  animEl.classList.add('card-anim--reveal');
  await sleep(lowEnd ? 300 : 500);

  // Phase 2 : vole vers la cible
  if (targetEl) {
    const targetRect = targetEl.getBoundingClientRect();
    const animRect = animEl.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (animRect.left + animRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (animRect.top + animRect.height / 2);

    animEl.style.setProperty('--fly-dx', `${dx}px`);
    animEl.style.setProperty('--fly-dy', `${dy}px`);
    animEl.classList.add('card-anim--fly');
    await sleep(lowEnd ? 250 : 400);
  }

  // Cleanup
  animEl.remove();
}
