/**
 * RedFlag — Routeur SPA
 *
 * Architecture mono-HTML : un seul index.html contient les 4 "écrans"
 * (home, lobby, config, game). Chacun est un <main data-screen="X">
 * caché par défaut sauf "home".
 *
 * Le routeur :
 *   - Lit le hash de l'URL (#/lobby, #/game, etc.)
 *   - Affiche l'écran correspondant en cachant les autres
 *   - Charge dynamiquement le module JS de cet écran (lazy-load)
 *
 * Avantages :
 *   - Pas de rechargement complet entre écrans (transitions fluides)
 *   - 1 seul HTML à déployer (GitHub Pages)
 *   - Réutilise les modules JS existants (home.js, lobby.js, etc.)
 */

import { injectSettingsUI, runSplash } from './settings.js';

const SCREENS = ['home', 'lobby', 'config', 'game'];

let currentScreen = null;
let loadedModules = new Set();

/**
 * Affiche un écran (cache les autres).
 */
function showScreen(screenName) {
  if (!SCREENS.includes(screenName)) {
    console.warn(`Écran inconnu: ${screenName}, fallback home`);
    screenName = 'home';
  }

  // ⚠ Si on quitte l'écran de jeu, on termine proprement la session
  // (annule tous les timers de bot, animations, fenêtre Nope...)
  if (currentScreen === 'game' && screenName !== 'game') {
    // Import dynamique pour éviter de charger le contrôleur sur la home
    import('./controllers/game-controller.js')
      .then(({ endGameSession }) => {
        if (endGameSession) endGameSession();
      })
      .catch(() => { /* pas grave si pas chargé */ });
  }

  // Cache tous les écrans
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.style.display = 'none';
  });

  // Affiche le bon
  const target = document.querySelector(`[data-screen="${screenName}"]`);
  if (target) {
    target.style.display = '';
  }

  currentScreen = screenName;

  // Pour le game-screen, gère le data-force-landscape
  if (screenName === 'game') {
    document.body.setAttribute('data-force-landscape', 'true');
    document.body.classList.add('in-game');
  } else {
    document.body.removeAttribute('data-force-landscape');
    document.body.classList.remove('in-game');
  }

  // Met à jour le contexte du notch settings
  updateSettingsContext(screenName);
}

/**
 * Met à jour le contexte du notch (active/désactive certains boutons).
 */
function updateSettingsContext(screenName) {
  const returnBtn = document.getElementById('btnSettingsReturnLobby');
  const leaveBtn = document.getElementById('btnSettingsLeaveGame');

  if (returnBtn) {
    returnBtn.disabled = ['home', 'lobby', 'config'].includes(screenName);
  }
  if (leaveBtn) {
    leaveBtn.disabled = screenName === 'home';
  }
}

/**
 * Charge le module JS associé à un écran (1x seulement, cache ensuite).
 */
async function loadScreenModule(screenName) {
  // Le screen 'game' se recharge à chaque visite pour démarrer une nouvelle partie.
  // Les autres ne sont chargés qu'une seule fois (DOM static).
  if (screenName !== 'game' && loadedModules.has(screenName)) return;
  loadedModules.add(screenName);

  try {
    switch (screenName) {
      case 'home':
        await import('./home.js');
        break;
      case 'config':
        await import('./config.js');
        break;
      case 'lobby':
        await import('./lobby.js');
        break;
      case 'game':
        // Cache-busting via timestamp pour forcer le re-import
        await import(`./game-entry.js?t=${Date.now()}`);
        break;
    }
  } catch (err) {
    console.error(`Échec chargement module ${screenName}:`, err);
    loadedModules.delete(screenName); // permet de réessayer
  }
}

/**
 * Navigue vers un écran (utilisable depuis n'importe quel module).
 * Met à jour le hash de l'URL pour que le bouton Retour navigateur fonctionne.
 */
export function navigateTo(screenName, params = {}) {
  // Construit le hash : #/screen?key=val
  let hash = `#/${screenName}`;
  const qs = new URLSearchParams(params).toString();
  if (qs) hash += `?${qs}`;
  window.location.hash = hash;
}

/**
 * Lit le hash actuel et navigue.
 */
function handleHashChange() {
  const hash = window.location.hash || '#/home';
  const match = hash.match(/^#\/([^?]+)(?:\?(.*))?$/);

  let screenName = 'home';
  let params = {};

  if (match) {
    screenName = match[1];
    if (match[2]) {
      params = Object.fromEntries(new URLSearchParams(match[2]));
    }
  }

  // Stocke params dans une variable globale pour les modules d'écran
  window.__redflagScreenParams = params;

  showScreen(screenName);
  loadScreenModule(screenName);
}

// Init au démarrage
window.addEventListener('hashchange', handleHashChange);

// Splash screen + injection notch settings
runSplash();
injectSettingsUI({ context: 'home' });

// Hash initial
handleHashChange();
