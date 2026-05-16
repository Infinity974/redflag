/**
 * RedFlag — Room Service Router
 *
 * Choisit dynamiquement entre le salon local (mémoire) et Firebase RTDB
 * selon la configuration de l'app.
 *
 * Pour activer Firebase :
 *   - Soit définir window.__REDFLAG_USE_FIREBASE = true avant chargement
 *   - Soit avoir une firebase-config.js valide (auto-détection)
 *
 * Tous les modules (home.js, lobby.js, config.js, game-entry.js) importent
 * depuis ce fichier — ils n'ont pas à savoir si on est local ou Firebase.
 */

// === Détection : Firebase activé ou pas ? ===
// Le jeu fonctionne désormais 100% en ligne. Firebase est OBLIGATOIRE.
// Le fallback local existe uniquement pour le développement/tests.
let _useFirebase = null;

async function detectMode() {
  if (_useFirebase !== null) return _useFirebase;

  // Override explicite (utile pour les tests)
  if (typeof window !== 'undefined' && window.__REDFLAG_USE_FIREBASE === false) {
    console.warn('[room-service] ⚠️ Mode local FORCÉ (override). Firebase désactivé.');
    _useFirebase = false;
    return false;
  }

  // Sinon : Firebase est obligatoire. On vérifie la config.
  try {
    const { firebaseConfig } = await import('./firebase-config.js');
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL) {
      _useFirebase = true;
      return true;
    }
    console.error('[room-service] ⚠️ Config Firebase invalide. Le multijoueur ne fonctionnera pas.');
  } catch (e) {
    console.error('[room-service] ⚠️ firebase-config.js manquant.', e);
  }

  // Fallback local seulement si Firebase est cassé (ne devrait pas arriver en prod)
  _useFirebase = false;
  return false;
}

// === Sélection dynamique du module ===
let _mod = null;
async function getMod() {
  if (_mod) return _mod;
  const useFirebase = await detectMode();
  if (useFirebase) {
    _mod = await import('./room-service-firebase.js');
    console.log('[room-service] Mode Firebase activé');
  } else {
    _mod = await import('./local-room-service.js');
    console.log('[room-service] Mode local activé');
  }
  return _mod;
}

// === Wrappers ===
// Toutes les fonctions sont async pour pouvoir await sur l'init du module.

export async function createRoom(opts) { return (await getMod()).createRoom(opts); }
export async function joinRoom(opts) { return (await getMod()).joinRoom(opts); }
export async function leaveRoom() { return (await getMod()).leaveRoom(); }
export async function addBot(level) { return (await getMod()).addBot(level); }
export async function kickPlayer(uid) { return (await getMod()).kickPlayer(uid); }
export async function transferHost(uid) { return (await getMod()).transferHost(uid); }
export async function updateConfig(patch) { return (await getMod()).updateConfig(patch); }
export async function startGame() { return (await getMod()).startGame(); }
export async function dissolveRoom() {
  const m = await getMod();
  if (m.dissolveRoom) return m.dissolveRoom();
}

/**
 * listenRoom est un peu spécial car local-room l'expose en sync alors
 * qu'on veut un modèle async-friendly. On wrappe pour que l'API soit
 * la même : la fonction retourne immédiatement un unsubscribe, mais
 * la souscription est mise en place dès que le module est chargé.
 */
let _pendingListeners = [];
export function listenRoom(callback) {
  let unsubReal = null;
  let cancelled = false;

  getMod().then(m => {
    if (cancelled) return;
    unsubReal = m.listenRoom(callback);
  });

  return () => {
    cancelled = true;
    if (unsubReal) unsubReal();
  };
}

/**
 * getRoom et isHost sont synchrones et accédés souvent. On utilise un
 * cache local que les listeners peuvent peupler.
 */
let _cachedRoom = null;
let _cachedMyUid = null;
let _modLoaded = false;

// Préchauffe le cache dès que possible (de façon non bloquante)
getMod().then(m => {
  _modLoaded = true;
  // Synchronise le cache via un listener interne
  m.listenRoom(room => { _cachedRoom = room; });
  if (m.getMyUid) _cachedMyUid = m.getMyUid();
});

export function getRoom() {
  if (!_modLoaded) return null;
  return _cachedRoom;
}

export function getMyUid() {
  if (!_modLoaded) return null;
  if (!_cachedMyUid) {
    // Fallback : cherche dans le module si chargé synchrone
    if (_mod && _mod.getMyUid) _cachedMyUid = _mod.getMyUid();
  }
  return _cachedMyUid;
}

export function isHost() {
  const room = getRoom();
  const uid = getMyUid();
  if (!room || !uid) return false;
  return room.meta?.hostUid === uid;
}

/**
 * Reconnect (Firebase only — utile après un refresh).
 */
export async function reconnectToRoom(code) {
  const m = await getMod();
  if (m.reconnectToRoom) return m.reconnectToRoom(code);
  return null;
}

/**
 * Force le mode (utile pour les tests ou pour basculer).
 */
export function forceMode(useFirebase) {
  _useFirebase = !!useFirebase;
  _mod = null;
  _modLoaded = false;
  _cachedRoom = null;
  _cachedMyUid = null;
}
