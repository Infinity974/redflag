/**
 * RedFlag — Drag & drop pour réordonner la main
 *
 * Module partagé entre game-controller (solo) et multiplayer-controller (multi).
 *
 * Usage:
 *   setupHandDragAndDrop(handEl, {
 *     getHand: () => state.players[myUid].hand,
 *     setHand: (newHand) => GameState.reorderHand(state, myUid, newHand),
 *     refresh: () => refreshUI(),
 *   });
 */

let dragSourceIdx = null;

export function setupHandDragAndDrop(handEl, opts) {
  if (!handEl) return;
  // Éviter de double-binder
  if (handEl.dataset.dndBound === 'true') return;
  handEl.dataset.dndBound = 'true';

  const { getHand, setHand, refresh } = opts;

  // ─── HTML5 Drag (desktop) ───────────────────────────────────────────
  handEl.addEventListener('dragstart', (e) => {
    const cardEl = e.target.closest('.game-card--in-hand');
    if (!cardEl) return;
    dragSourceIdx = parseInt(cardEl.dataset.handIndex, 10);
    cardEl.classList.add('game-card--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSourceIdx.toString());
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
        const rect = cardEl.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (e.clientX < midX) cardEl.classList.add('game-card--drop-before');
        else cardEl.classList.add('game-card--drop-after');
      }
    }
  });

  handEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const cardEl = e.target.closest('.game-card--in-hand');
    if (!cardEl || dragSourceIdx === null) return;
    let targetIdx = parseInt(cardEl.dataset.handIndex, 10);
    if (isNaN(targetIdx) || targetIdx === dragSourceIdx) return;

    const rect = cardEl.getBoundingClientRect();
    const insertAfter = e.clientX >= rect.left + rect.width / 2;
    if (insertAfter && targetIdx < dragSourceIdx) targetIdx += 1;
    if (!insertAfter && targetIdx > dragSourceIdx) targetIdx -= 1;

    const hand = getHand();
    if (!hand) return;
    const newHand = [...hand];
    const [moved] = newHand.splice(dragSourceIdx, 1);
    const finalIdx = Math.max(0, Math.min(targetIdx, newHand.length));
    newHand.splice(finalIdx, 0, moved);

    handEl.dataset.dragging = 'false';
    setHand(newHand);
    refresh();
  });

  // ─── Touch (mobile) ─────────────────────────────────────────────────
  let touchSourceIdx = null;
  let touchSourceCard = null;
  let touchTimer = null;
  let touchStartY = 0;
  let touchStartX = 0;
  let isDraggingTouch = false;

  handEl.addEventListener('touchstart', (e) => {
    const cardEl = e.target.closest('.game-card--in-hand');
    if (!cardEl) return;
    touchSourceIdx = parseInt(cardEl.dataset.handIndex, 10);
    touchSourceCard = cardEl;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDraggingTouch = false;

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
        if (x < rect.left + rect.width / 2) cardBelow.classList.add('game-card--drop-before');
        else cardBelow.classList.add('game-card--drop-after');
      }
    }
  }, { passive: false });

  handEl.addEventListener('touchend', (e) => {
    clearTimeout(touchTimer);
    if (!touchSourceCard) return;

    if (isDraggingTouch) {
      e.preventDefault();
      const x = e.changedTouches[0].clientX;
      const y = e.changedTouches[0].clientY;
      const elementBelow = document.elementFromPoint(x, y);
      const targetCard = elementBelow?.closest('.game-card--in-hand');

      if (targetCard && targetCard !== touchSourceCard) {
        const targetIdx = parseInt(targetCard.dataset.handIndex, 10);
        if (!isNaN(targetIdx) && targetIdx !== touchSourceIdx) {
          const hand = getHand();
          if (hand) {
            const newHand = [...hand];
            const [moved] = newHand.splice(touchSourceIdx, 1);
            let finalIdx = targetIdx;
            finalIdx = targetIdx > touchSourceIdx ? targetIdx - 1 : targetIdx;
            newHand.splice(Math.max(0, Math.min(finalIdx, newHand.length)), 0, moved);
            handEl.dataset.dragging = 'false';
            setHand(newHand);
            refresh();
          }
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
}
