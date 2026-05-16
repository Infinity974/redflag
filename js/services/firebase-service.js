/**
 * RedFlag — Firebase Service
 *
 * Wrapper centralisé sur le SDK Firebase pour :
 * - Initialisation unique (lazy)
 * - Auth anonyme automatique
 * - Helpers RTDB (read, write, listen, remove)
 *
 * Utilise les modules Firebase 10 via CDN (modular SDK, pas de bundler nécessaire).
 *
 * IMPORTANT : tous les chemins RTDB doivent être préfixés selon la config dans
 * firebase-config.js (ex: rooms/{code}/...).
 */

import { firebaseConfig, firebaseAppConfig } from './firebase-config.js';

// === État du service (singleton) ===
let firebaseApp = null;
let auth = null;
let database = null;
let currentUser = null;
let initPromise = null;

// === Modules Firebase chargés depuis le CDN ===
const SDK_VERSION = '10.13.0';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

let firebaseModules = null;

/**
 * Charge les modules Firebase nécessaires (lazy, 1 fois).
 */
async function loadFirebaseModules() {
  if (firebaseModules) return firebaseModules;

  const [appModule, authModule, dbModule] = await Promise.all([
    import(`${SDK_BASE}/firebase-app.js`),
    import(`${SDK_BASE}/firebase-auth.js`),
    import(`${SDK_BASE}/firebase-database.js`),
  ]);

  firebaseModules = {
    initializeApp: appModule.initializeApp,
    getAuth: authModule.getAuth,
    signInAnonymously: authModule.signInAnonymously,
    onAuthStateChanged: authModule.onAuthStateChanged,
    getDatabase: dbModule.getDatabase,
    ref: dbModule.ref,
    set: dbModule.set,
    get: dbModule.get,
    update: dbModule.update,
    remove: dbModule.remove,
    push: dbModule.push,
    onValue: dbModule.onValue,
    onChildAdded: dbModule.onChildAdded,
    onChildRemoved: dbModule.onChildRemoved,
    onDisconnect: dbModule.onDisconnect,
    serverTimestamp: dbModule.serverTimestamp,
    runTransaction: dbModule.runTransaction,
    off: dbModule.off,
    child: dbModule.child,
  };
  return firebaseModules;
}

/**
 * Initialise Firebase + auth anonyme.
 * Renvoie une Promise qui résout avec { uid, isNew } quand l'utilisateur est connecté.
 */
export async function initFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const fb = await loadFirebaseModules();

    firebaseApp = fb.initializeApp(firebaseConfig);
    auth = fb.getAuth(firebaseApp);
    database = fb.getDatabase(firebaseApp);

    // Restaure l'UID stocké si possible (continuité session)
    const previousUid = localStorage.getItem('redflag_uid');

    return new Promise((resolve, reject) => {
      // 1. Écoute le changement d'auth
      const unsubscribe = fb.onAuthStateChanged(auth, async (user) => {
        if (user) {
          currentUser = user;
          unsubscribe();
          const isNew = previousUid !== user.uid;
          if (isNew) {
            localStorage.setItem('redflag_uid', user.uid);
          }
          resolve({ uid: user.uid, isNew });
        }
      }, reject);

      // 2. Lance le sign-in anonyme si pas déjà connecté
      fb.signInAnonymously(auth).catch(reject);
    });
  })();

  return initPromise;
}

/**
 * Renvoie l'UID de l'utilisateur connecté (lance une erreur si pas connecté).
 */
export function getCurrentUid() {
  if (!currentUser) throw new Error('Firebase pas encore initialisé');
  return currentUser.uid;
}

/**
 * Renvoie un ref RTDB sur le path donné.
 */
function getRef(path) {
  if (!database || !firebaseModules) throw new Error('Firebase pas initialisé');
  return firebaseModules.ref(database, path);
}

/**
 * Lit une valeur dans RTDB (one-shot).
 */
export async function rtdbGet(path) {
  const ref = getRef(path);
  const snap = await firebaseModules.get(ref);
  return snap.exists() ? snap.val() : null;
}

/**
 * Écrit une valeur dans RTDB (remplace tout).
 */
export async function rtdbSet(path, value) {
  const ref = getRef(path);
  return firebaseModules.set(ref, value);
}

/**
 * Met à jour partiellement (merge).
 */
export async function rtdbUpdate(path, partialValue) {
  const ref = getRef(path);
  return firebaseModules.update(ref, partialValue);
}

/**
 * Supprime un noeud.
 */
export async function rtdbRemove(path) {
  const ref = getRef(path);
  return firebaseModules.remove(ref);
}

/**
 * Push (génère un ID auto).
 */
export async function rtdbPush(path, value) {
  const ref = getRef(path);
  const newRef = firebaseModules.push(ref);
  await firebaseModules.set(newRef, value);
  return newRef.key;
}

/**
 * Écoute les changements d'une valeur en temps réel.
 * Retourne une fonction de nettoyage à appeler pour stopper l'écoute.
 *
 * @param path Chemin RTDB
 * @param callback Appelée avec la valeur à chaque changement
 * @returns {() => void} Unsubscribe
 */
export function rtdbListen(path, callback) {
  const ref = getRef(path);
  const unsubscribe = firebaseModules.onValue(ref, (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });
  return unsubscribe;
}

/**
 * Écoute les ajouts dans une liste (utile pour les actions).
 */
export function rtdbListenAdded(path, callback) {
  const ref = getRef(path);
  const unsubscribe = firebaseModules.onChildAdded(ref, (snap) => {
    callback(snap.key, snap.val());
  });
  return unsubscribe;
}

/**
 * Transaction RTDB (lecture + écriture atomiques).
 * Utile pour rejoindre un salon de manière concurrente.
 */
export async function rtdbTransaction(path, updateFn) {
  const ref = getRef(path);
  return firebaseModules.runTransaction(ref, updateFn);
}

/**
 * onDisconnect : execute une action automatique côté serveur quand le client se déconnecte.
 * Utilisé pour marquer un joueur comme "offline" même s'il ferme brutalement la fenêtre.
 *
 * @param path Chemin RTDB
 * @param value Valeur à écrire à la déconnexion (null = remove)
 */
export function rtdbOnDisconnect(path, value) {
  const ref = getRef(path);
  if (value === null) {
    return firebaseModules.onDisconnect(ref).remove();
  }
  return firebaseModules.onDisconnect(ref).set(value);
}

/**
 * Server timestamp (pour stocker des dates serveur cohérentes).
 */
export function serverTimestamp() {
  if (!firebaseModules) throw new Error('Firebase pas initialisé');
  return firebaseModules.serverTimestamp();
}

/**
 * Génère un code de salon unique (4 caractères).
 */
export function generateRoomCode() {
  const chars = firebaseAppConfig.roomCode.chars;
  const len = firebaseAppConfig.roomCode.length;
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Vérifie si un salon existe.
 */
export async function roomExists(code) {
  const data = await rtdbGet(`${firebaseAppConfig.rooms.basePath}/${code}/meta`);
  return data !== null;
}
