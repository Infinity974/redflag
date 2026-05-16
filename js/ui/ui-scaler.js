/**
 * RedFlag — UI Scaler V5
 *
 * Approche : ratio cible 16:9, scale JS calculé en min(viewport.w/REF_W, viewport.h/REF_H).
 * Le scale est appliqué via --ui-scale en CSS, et toutes les tailles fluides
 * sont calculées par rapport à cette variable.
 *
 * Avantage : "vrai effet d'app mobile" — sur grand écran tout est gros,
 * sur petit écran tout est proportionnellement réduit, sans déformation.
 */

const REF_WIDTH = 1280;
const REF_HEIGHT = 720;
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.5;

let resizeTimeout = null;
let observer = null;

function computeScale() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Le scale est limité par la dimension la plus contraignante
  const scaleW = w / REF_WIDTH;
  const scaleH = h / REF_HEIGHT;
  let scale = Math.min(scaleW, scaleH);

  // Borne pour éviter extrêmes
  scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

  return scale;
}

function applyScale() {
  const scale = computeScale();
  document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3));

  // Pour debug
  if (window.__DEBUG_SCALE) {

  }
}

function debouncedApply() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(applyScale, 80);
}

export function initUIScale() {
  applyScale();

  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(debouncedApply);
    observer.observe(document.body);
  } else {
    window.addEventListener('resize', debouncedApply);
  }

  window.addEventListener('orientationchange', () => {
    setTimeout(applyScale, 250);
  });
}

export function getCurrentScale() {
  return computeScale();
}
