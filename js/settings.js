/**
 * RedFlag — Settings Module
 *
 * Gère :
 * - 4 thèmes de couleurs (default, synthwave, cyberpunk, love)
 * - Mode clair / sombre
 * - Mode fluide (anti-lag) avec détection auto
 * - Notch toujours visible
 * - Modale paramètres (thèmes, règles, retour salon, quitter)
 *
 * Utilisé sur toutes les pages : home, lobby, config, game.
 */

const STORAGE_KEYS = {
  COLOR_THEME: 'redflag_colorTheme',
  LIGHT_MODE: 'redflag_lightMode',
  PERF_MODE: 'redflag_perfMode',
};

const THEMES = ['default', 'synthwave', 'cyberpunk', 'love'];

/**
 * Détecte si l'appareil est probablement low-end.
 */
function isLowEndDevice() {
  const cores = navigator.hardwareConcurrency || 4;
  const ram = navigator.deviceMemory || 4;
  return cores <= 4 || ram <= 4;
}

/**
 * Applique un thème de couleurs.
 */
export function applyColorTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'default';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.COLOR_THEME, theme);
  // Sync les radios
  document.querySelectorAll('input[name="color-theme"]').forEach(r => {
    r.checked = (r.value === theme);
  });
}

/**
 * Applique le mode clair / sombre.
 * @param {boolean} isLight
 */
export function applyLightMode(isLight) {
  if (isLight) {
    document.documentElement.classList.add('light-mode');
    if (document.body) document.body.classList.add('light-mode');
  } else {
    document.documentElement.classList.remove('light-mode');
    if (document.body) document.body.classList.remove('light-mode');
  }
  localStorage.setItem(STORAGE_KEYS.LIGHT_MODE, isLight ? '1' : '0');
  // Sync UI (peut être null si modale pas encore injectée — protégé)
  const toggle = document.querySelector('[data-toggle="lightMode"]');
  if (toggle) toggle.classList.toggle('active', isLight);
  const label = document.getElementById('lightModeLabel');
  if (label) label.textContent = isLight ? '☀️ Mode Clair' : '🌙 Mode Sombre';
}

/**
 * Applique le mode fluide (anti-lag).
 * @param {boolean} isPerf
 */
export function applyPerfMode(isPerf) {
  if (isPerf) {
    if (document.body) document.body.classList.add('low-end-mode');
  } else {
    if (document.body) document.body.classList.remove('low-end-mode');
  }
  localStorage.setItem(STORAGE_KEYS.PERF_MODE, isPerf ? '1' : '0');
  const toggle = document.querySelector('[data-toggle="perfMode"]');
  if (toggle) toggle.classList.toggle('active', isPerf);
}

/**
 * Initialise depuis localStorage (avec détection auto pour le mode fluide).
 * À appeler avant tout rendu.
 */
export function initSettings() {
  // Thème de couleurs (sur documentElement, toujours dispo)
  const savedTheme = localStorage.getItem(STORAGE_KEYS.COLOR_THEME) || 'default';
  applyColorTheme(savedTheme);

  // Mode clair (par défaut : sombre)
  const savedLight = localStorage.getItem(STORAGE_KEYS.LIGHT_MODE) === '1';

  // Mode fluide
  const savedPerf = localStorage.getItem(STORAGE_KEYS.PERF_MODE);
  let shouldUsePerf = false;
  if (savedPerf === '1') {
    shouldUsePerf = true;
  } else if (savedPerf === null && isLowEndDevice()) {
    shouldUsePerf = true;
  }

  // Si le body n'existe pas encore (script appelé dans <head>), différer
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => {
      applyLightMode(savedLight);
      applyPerfMode(shouldUsePerf);
    }, { once: true });
  } else {
    applyLightMode(savedLight);
    applyPerfMode(shouldUsePerf);
  }
}

/**
 * Construit le HTML du notch et de la modale.
 * Injection dans le body.
 *
 * @param {object} options - { context: 'home' | 'lobby' | 'setup' | 'game' }
 */
export function injectSettingsUI(options = {}) {
  // Si DOM pas prêt, on diffère l'injection
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => injectSettingsUI(options), { once: true });
    return;
  }

  const context = options.context || 'home';

  // Si déjà injecté, skip
  if (document.getElementById('settings-notch')) return;

  // === NOTCH ===
  const notchBg = document.createElement('div');
  notchBg.id = 'settings-notch-bg';
  document.body.appendChild(notchBg);

  const notch = document.createElement('div');
  notch.id = 'settings-notch';
  notch.title = 'Paramètres';
  notch.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
    <span>Paramètres</span>
  `;
  document.body.appendChild(notch);

  // === MODALE ===
  const modal = document.createElement('div');
  modal.id = 'settingsModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>⚙ Préférences</h2>
        <button class="modal-close" aria-label="Fermer">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">🎨 Thème visuel</div>
        <div class="theme-grid">
          <label class="theme-option">
            <input type="radio" name="color-theme" value="default">
            <div class="theme-dot" style="background:linear-gradient(135deg,#FF4FA3,#9B4FFF);"></div>
            <span>Original</span>
          </label>
          <label class="theme-option">
            <input type="radio" name="color-theme" value="synthwave">
            <div class="theme-dot" style="background:linear-gradient(135deg,#FF00C8,#00F0FF);"></div>
            <span>Synthwave</span>
          </label>
          <label class="theme-option">
            <input type="radio" name="color-theme" value="cyberpunk">
            <div class="theme-dot" style="background:linear-gradient(135deg,#00F0FF,#A855F7);"></div>
            <span>Cyberpunk</span>
          </label>
          <label class="theme-option">
            <input type="radio" name="color-theme" value="love">
            <div class="theme-dot" style="background:linear-gradient(135deg,#FF69B4,#FFAA82);"></div>
            <span>Love Story</span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="toggle-row">
          <div class="toggle-label" id="lightModeLabel">🌙 Mode Sombre</div>
          <div class="toggle-switch" data-toggle="lightMode"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="toggle-row">
          <div class="toggle-label">
            🚀 Mode Fluide
            <span class="toggle-hint">Désactive les effets lourds (anti-lag)</span>
          </div>
          <div class="toggle-switch" data-toggle="perfMode"></div>
        </div>
      </div>

      <button class="settings-btn" id="btnSettingsRules">
        📖 Comment jouer ?
      </button>

      <div class="settings-section--actions">
        <button class="settings-btn settings-btn--gold" id="btnSettingsReturnLobby" ${context === 'home' || context === 'lobby' || context === 'config' ? 'disabled' : ''}>
          🏠 Retourner au menu
        </button>
        <button class="settings-btn settings-btn--danger" id="btnSettingsLeaveGame" ${context === 'home' ? 'disabled' : ''}>
          🚪 Quitter le jeu
        </button>
      </div>

      <p class="settings-footer">RedFlag — Édition Y2K</p>
    </div>
  `;
  document.body.appendChild(modal);

  // Mark le body avec le contexte (pour ajustements CSS)
  if (context === 'game') {
    document.body.classList.add('in-game');
  }

  // === EVENT HANDLERS ===
  // Ouvrir modale
  notch.addEventListener('click', () => {
    modal.classList.add('active');
  });

  // Fermer modale (X ou clic backdrop)
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Thèmes
  modal.querySelectorAll('input[name="color-theme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) applyColorTheme(e.target.value);
    });
  });

  // Toggle mode clair
  modal.querySelector('[data-toggle="lightMode"]').addEventListener('click', () => {
    const isCurrentlyLight = document.documentElement.classList.contains('light-mode');
    applyLightMode(!isCurrentlyLight);
  });

  // Toggle mode fluide
  modal.querySelector('[data-toggle="perfMode"]').addEventListener('click', () => {
    const isCurrentlyPerf = document.body.classList.contains('low-end-mode');
    applyPerfMode(!isCurrentlyPerf);
  });

  // Bouton règles
  modal.querySelector('#btnSettingsRules').addEventListener('click', () => {
    modal.classList.remove('active');
    setTimeout(() => showRulesModal(), 200);
  });

  // Retour menu (selon contexte)
  modal.querySelector('#btnSettingsReturnLobby').addEventListener('click', async () => {
    modal.classList.remove('active');
    const ok = await showConfirmDialog({
      emoji: '🏠',
      title: 'Retour au menu ?',
      message: 'La partie en cours sera abandonnée.',
      yesLabel: 'Confirmer',
      noLabel: 'Annuler',
    });
    if (ok) {
      // Navigation SPA : changer le hash déclenche le routeur app.js
      window.location.hash = '#/home';
    }
  });

  // Quitter
  modal.querySelector('#btnSettingsLeaveGame').addEventListener('click', async () => {
    modal.classList.remove('active');
    // Si on est en partie, on a un salon → retour lobby pour pouvoir relancer
    // Sinon retour à la home
    const inGame = document.body.classList.contains('in-game');
    const ok = await showConfirmDialog({
      emoji: '🚪',
      title: 'Quitter la partie ?',
      message: inGame
        ? 'Tu vas retourner au salon. La partie en cours sera arrêtée.'
        : 'Tu vas être redirigé vers l\'écran d\'accueil.',
      yesLabel: 'Quitter',
      noLabel: 'Rester',
    });
    if (ok) {
      // Si on est en partie et qu'un salon existe, retour au lobby
      // Sinon retour à la home
      if (inGame) {
        try {
          const { getRoom } = await import('./services/local-room-service.js');
          if (getRoom()) {
            window.location.hash = '#/lobby';
            return;
          }
        } catch {}
      }
      window.location.hash = '#/home';
    }
  });

  // Sync visuel des toggles (au cas où l'init a été faite avant l'injection du HTML)
  applyLightMode(document.documentElement.classList.contains('light-mode'));
  applyPerfMode(document.body.classList.contains('low-end-mode'));
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'default';
  applyColorTheme(currentTheme);
}

/**
 * Boîte de confirmation custom (Promise<boolean>)
 */
export function showConfirmDialog({ emoji = '❓', title = 'Confirmer ?', message = '', yesLabel = 'Oui', noLabel = 'Non' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '10001';
    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 360px;">
        <div class="confirm-dialog">
          <div class="confirm-dialog__emoji">${emoji}</div>
          <h3 class="confirm-dialog__title">${escapeHtml(title)}</h3>
          <p class="confirm-dialog__message">${escapeHtml(message)}</p>
          <div class="confirm-dialog__actions">
            <button class="settings-btn" data-action="no">${escapeHtml(noLabel)}</button>
            <button class="settings-btn settings-btn--danger" data-action="yes">${escapeHtml(yesLabel)}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
    };

    overlay.querySelector('[data-action="yes"]').addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
    overlay.querySelector('[data-action="no"]').addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });
  });
}

/**
 * Affiche les règles du jeu.
 */
export function showRulesModal() {
  let rulesModal = document.getElementById('rulesModal');
  if (!rulesModal) {
    rulesModal = document.createElement('div');
    rulesModal.id = 'rulesModal';
    rulesModal.className = 'modal-overlay';
    rulesModal.innerHTML = `
      <div class="modal-content" style="max-width: 540px;">
        <div class="modal-header">
          <h2>📖 Comment jouer ?</h2>
          <button class="modal-close" aria-label="Fermer">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="rules-content">
          <div class="rules-section">
            <h3 class="rules-section__title">🎯 But du jeu</h3>
            <p>Séduis le Crush mystère pour atteindre <strong>100% de jauge</strong> et survis 1 tour de table complet pour <strong>décrocher le date</strong>. Évite d'être Ghosté ou de descendre à -100%.</p>
          </div>

          <div class="rules-section">
            <h3 class="rules-section__title">🃏 Les types de cartes</h3>
            <ul class="rules-list">
              <li><strong>🟢 Green Flag</strong> : ajoute des points sur quelqu'un. 1 max par tour.</li>
              <li><strong>🔴 Red Flag</strong> : enlève des points. Termine ton tour. 1 max par tour.</li>
              <li><strong>💕 Crush</strong> : se joue en combo (×2 ou ×3) pour voler ou demander des cartes.</li>
              <li><strong>📲 Pioche</strong> : force l'adversaire à piocher (chaîne possible).</li>
              <li><strong>🚫 Nope</strong> : annule l'action d'un adversaire (5s pour réagir).</li>
              <li><strong>🛡 Bouclier</strong> : protège d'une carte Ghosté.</li>
              <li><strong>⚡ Action</strong> : effets variés (Mélanger, Faveur, Divination...).</li>
            </ul>
          </div>

          <div class="rules-section">
            <h3 class="rules-section__title">✨ Mécaniques avancées</h3>
            <ul class="rules-list">
              <li><strong>Traits du Crush</strong> : se révèlent tour par tour. Si la carte matche, COUP CRITIQUE (×2 effet).</li>
              <li><strong>Conditional cards</strong> : effet inversé si le Crush n'a pas le bon trait.</li>
              <li><strong>Combo Crush ×2</strong> : voler 1 carte au hasard à un adversaire.</li>
              <li><strong>Combo Crush ×3</strong> : demander une carte précise à un adversaire.</li>
              <li><strong>Danger -100%</strong> : si tu restes 1 tour à -100%, tu es éliminé.</li>
            </ul>
          </div>

          <div class="rules-section">
            <h3 class="rules-section__title">🚫 Système de Nope</h3>
            <p>Quand un joueur joue une attaque, tous les autres ont <strong>5 secondes</strong> pour poser un Nope qui annule l'action. Si quelqu'un Nope, l'attaquant peut contre-Nope (temps illimité). Le dernier qui ne se fait pas re-Noper gagne.</p>
          </div>

          <div class="rules-section">
            <h3 class="rules-section__title">💔 Cartes Ghosté</h3>
            <p>Cachées dans la pioche. Si tu en pioches une sans bouclier, tu es éliminé du game. Avec un bouclier, tu peux la replacer où tu veux dans le deck.</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(rulesModal);

    rulesModal.querySelector('.modal-close').addEventListener('click', () => {
      rulesModal.classList.remove('active');
    });
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) rulesModal.classList.remove('active');
    });
  }
  rulesModal.classList.add('active');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * SPLASH SCREEN — Animation de chargement Y2K Dating.
 *
 * Affichée 1x par session (sessionStorage). Sur la home uniquement par défaut.
 * Steps :
 *  - 0   : invisible
 *  - 400ms  : step-1 → "?" apparaît
 *  - 1600ms : step-2 → "?" → "💕" + titre RedFlag
 *  - 3400ms : step-3 → fade out
 *  - 4500ms : remove du DOM
 *
 * @param {object} options
 *   - force: true     → joue même si déjà vu cette session
 *   - skipIfSeen: true (default) → skip si déjà vu cette session
 *   - emoji: '💕'     → emoji final (defaut cœur)
 *   - subtitle: 'Le party game...' → sous-titre custom
 */
export function runSplash(options = {}) {
  const SESSION_KEY = 'redflag_splashSeen';
  const force = options.force === true;
  const skipIfSeen = options.skipIfSeen !== false;
  const finalEmoji = options.emoji || '💕';
  const subtitle = options.subtitle || 'Le party game où séduire, c\'est survivre';

  // Skip si déjà vu cette session (sauf si force)
  if (skipIfSeen && !force) {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch (e) { /* sessionStorage indispo */ }
  }

  // Marquer comme vu
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}

  // Crée la structure DOM
  const splash = document.createElement('div');
  splash.id = 'splash-screen';
  splash.innerHTML = `
    <div class="splash-scanline"></div>
    <div class="splash-mark">
      <div class="splash-icon-q">?</div>
      <div class="splash-icon-s">${escapeHtml(finalEmoji)}</div>
    </div>
    <h1 class="splash-title">
      <span class="gradient">REDFLAG</span>
    </h1>
    <div class="splash-subtitle">${escapeHtml(subtitle)}</div>
  `;

  // Cœurs flottants décoratifs (3 positions)
  const heartPositions = [
    { left: '15%', delay: '0.6s', emoji: '💖' },
    { left: '82%', delay: '1.2s', emoji: '💕' },
    { left: '50%', delay: '1.8s', emoji: '✨' },
  ];
  heartPositions.forEach(({ left, delay, emoji }) => {
    const heart = document.createElement('div');
    heart.className = 'splash-heart';
    heart.style.left = left;
    heart.style.bottom = '30%';
    heart.style.animationDelay = delay;
    heart.textContent = emoji;
    splash.appendChild(heart);
  });

  document.body.appendChild(splash);

  // Séquence des steps
  setTimeout(() => splash.classList.add('step-1'), 400);
  setTimeout(() => splash.classList.add('step-2'), 1600);
  setTimeout(() => splash.classList.add('step-3'), 3400);
  setTimeout(() => {
    if (splash.parentNode) splash.parentNode.removeChild(splash);
  }, 4500);
}

/**
 * Toast léger (autonome, indépendant du game-renderer)
 * Pour les pages qui n'ont pas accès au full dialog-manager.
 */
export function showSimpleToast(message, type = 'info', durationMs = 2500) {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => showSimpleToast(message, type, durationMs), { once: true });
    return;
  }

  let container = document.getElementById('simple-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'simple-toast-container';
    container.style.cssText = `
      position: fixed; top: max(80px, env(safe-area-inset-top));
      left: 50%; transform: translateX(-50%);
      z-index: 10500; pointer-events: none;
      display: flex; flex-direction: column; gap: 0.5rem; align-items: center;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `simple-toast simple-toast--${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    padding: 0.75rem 1.25rem;
    background: rgba(20, 10, 35, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(var(--primary-rgb), 0.4);
    border-radius: 999px;
    color: white;
    font-family: var(--font-display, sans-serif);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(var(--primary-rgb), 0.3);
    opacity: 0;
    transform: translateY(-12px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: auto;
    max-width: 88vw;
    text-align: center;
  `;
  if (type === 'error' || type === 'warning') {
    toast.style.borderColor = 'rgba(var(--danger-rgb), 0.6)';
    toast.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(var(--danger-rgb), 0.4)';
  }
  container.appendChild(toast);

  // Apparition
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Disparition
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px)';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
