/**
 * RedFlag — Service Firebase avec API compatible local-room-service
 *
 * Ce service utilise Firebase RTDB pour gérer les salons en multijoueur réel.
 * Il expose la même API que local-room-service.js pour pouvoir être utilisé
 * en remplacement transparent.
 *
 * Différences clés vs local-room :
 *   - createRoom/joinRoom/etc. utilisent Firebase RTDB
 *   - Les bots restent gérés côté client de l'hôte (ils sont juste stockés
 *     dans /players avec un flag isBot, et l'hôte joue pour eux)
 *   - listenRoom retourne l'état en temps réel sur tous les clients
 *
 * Pour que le code de l'app puisse switcher entre local et Firebase :
 *   - import { createRoom, ... } from './services/room-service.js';
 *   - room-service.js choisit dynamiquement local ou Firebase selon la config
 */

import {
  initFirebase, getCurrentUid, generateRoomCode, roomExists,
  rtdbGet, rtdbSet, rtdbUpdate, rtdbRemove, rtdbListen,
  rtdbOnDisconnect, serverTimestamp,
} from './firebase-service.js';

const BASE = 'rooms';

const DEFAULT_CONFIG = {
  gameMode: 'cards',
  botLevel: 'normal',
  traitsAtStart: 1,
  gameSpeed: 'normal',
  maxRedFlags: 5,
  nopeEnabled: true,
};

// === État local pour l'API synchrone (getRoom, isHost, etc.) ===
let currentRoom = null;
let currentCode = null;
let myUid = null;
let listeners = [];
let unsubscribeRoom = null;
let heartbeatTimer = null;

const HEARTBEAT_INTERVAL_MS = 3000; // 3s

/**
 * Démarre le heartbeat : écrit lastSeen toutes les 3s.
 * Permet aux autres clients de détecter ta déconnexion.
 */
export function startHeartbeat(code) {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    if (!myUid || !code) return;
    try {
      await rtdbUpdate(`${BASE}/${code}/players/${myUid}`, {
        lastSeen: Date.now(),
        isOnline: true,
      });
    } catch (e) {
      console.warn('Heartbeat failed:', e);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Init au démarrage : appelle initFirebase pour récupérer l'UID.
 */
async function ensureInitialized() {
  if (!myUid) {
    const result = await initFirebase();
    myUid = result.uid;
  }
  return myUid;
}

function notifyLocal() {
  for (const cb of listeners) cb(currentRoom);
}

/**
 * Crée un nouveau salon Firebase.
 */
export async function createRoom({ nickname, color = '#FF4FA3' }) {
  await ensureInitialized();

  // Génère un code unique
  let code = null;
  for (let i = 0; i < 5; i++) {
    const tryCode = generateRoomCode();
    const exists = await roomExists(tryCode);
    if (!exists) { code = tryCode; break; }
  }
  if (!code) throw new Error('Impossible de générer un code unique. Réessaie.');

  await rtdbSet(`${BASE}/${code}`, {
    meta: {
      code,
      hostUid: myUid,
      status: 'lobby',
      createdAt: Date.now(),
    },
    players: {
      [myUid]: {
        uid: myUid,
        nickname: nickname || 'Hôte',
        color: color || '#FF4FA3',
        isHost: true,
        isBot: false,
        isOnline: true,
        joinedAt: Date.now(),  // clientTime pour tri facile
        lastSeen: Date.now(),
      },
    },
    config: { ...DEFAULT_CONFIG },
  });

  // Si on déco brutalement, marque-nous offline
  rtdbOnDisconnect(`${BASE}/${code}/players/${myUid}/isOnline`, false);

  // Démarre le heartbeat
  startHeartbeat(code);

  currentCode = code;
  await subscribeToRoom(code);

  return { code, uid: myUid };
}

/**
 * Rejoint un salon existant via son code.
 */
export async function joinRoom({ code, nickname, color = '#FF4FA3' }) {
  await ensureInitialized();
  code = code.toUpperCase();

  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) throw new Error('Ce salon n\'existe pas.');
  if (meta.status === 'playing') throw new Error('La partie a déjà commencé.');
  if (meta.status === 'ended') throw new Error('Cette partie est terminée.');

  // Vérifie ban
  const ban = await rtdbGet(`${BASE}/${code}/bans/${myUid}`);
  if (ban) throw new Error('Tu as été exclu de ce salon par l\'hôte.');

  const players = await rtdbGet(`${BASE}/${code}/players`) || {};
  const playerCount = Object.keys(players).length;
  if (playerCount >= 8) throw new Error('Salon complet (8 joueurs max).');

  // Si déjà dedans (reconnexion), update juste isOnline + lastSeen
  if (players[myUid]) {
    await rtdbUpdate(`${BASE}/${code}/players/${myUid}`, {
      nickname, color, isOnline: true,
      lastSeen: Date.now(),
    });
  } else {
    await rtdbSet(`${BASE}/${code}/players/${myUid}`, {
      uid: myUid,
      nickname: nickname || 'Joueur',
      color: color || '#FF4FA3',
      isHost: false,
      isBot: false,
      isOnline: true,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
  }

  rtdbOnDisconnect(`${BASE}/${code}/players/${myUid}/isOnline`, false);

  // Démarre le heartbeat
  startHeartbeat(code);

  currentCode = code;
  await subscribeToRoom(code);

  return { code, uid: myUid };
}

/**
 * S'abonne aux changements du salon courant (interne).
 */
async function subscribeToRoom(code) {
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  unsubscribeRoom = rtdbListen(`${BASE}/${code}`, (data) => {
    currentRoom = data;
    notifyLocal();
  });
}

/**
 * Quitte le salon. Si l'hôte quitte, transfère le rôle à un autre humain
 * ou supprime le salon si c'était le seul.
 */
export async function leaveRoom() {
  if (!currentCode) return;
  const code = currentCode;

  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) {
    cleanupLocal();
    return;
  }

  const players = await rtdbGet(`${BASE}/${code}/players`) || {};
  const otherHumans = Object.entries(players).filter(([k, p]) => k !== myUid && !p.isBot);

  // Si je suis l'hôte
  if (meta.hostUid === myUid) {
    if (otherHumans.length === 0) {
      // Pas d'autre humain, supprime tout le salon
      await rtdbRemove(`${BASE}/${code}`);
    } else {
      // Transfère l'hôte au plus ancien humain
      const sorted = otherHumans.sort(([, a], [, b]) =>
        (a.joinedAt || 0) - (b.joinedAt || 0)
      );
      const newHostUid = sorted[0][0];
      await rtdbUpdate(`${BASE}/${code}`, {
        [`meta/hostUid`]: newHostUid,
        [`players/${newHostUid}/isHost`]: true,
        [`players/${myUid}`]: null,
      });
    }
  } else {
    // Joueur normal : juste se retirer
    await rtdbRemove(`${BASE}/${code}/players/${myUid}`);
  }

  cleanupLocal();
}

function cleanupLocal() {
  stopHeartbeat();
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  currentRoom = null;
  currentCode = null;
  notifyLocal();
}

/**
 * Ajoute un bot au salon (hôte uniquement).
 */
export async function addBot(botLevel = 'normal') {
  if (!currentCode) throw new Error('Pas de salon');
  const code = currentCode;

  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) throw new Error('Salon introuvable');
  if (meta.hostUid !== myUid) throw new Error('Seul l\'hôte peut ajouter des bots');

  const players = await rtdbGet(`${BASE}/${code}/players`) || {};
  if (Object.keys(players).length >= 8) throw new Error('Maximum 8 joueurs');

  // Génère nom + couleur uniques
  const botNames = ['Bot Léo', 'Bot Maya', 'Bot Sam', 'Bot Zoé', 'Bot Théo', 'Bot Inès', 'Bot Hugo', 'Bot Lou'];
  const botColors = ['#FF6B9D', '#4FC3F7', '#FFD54F', '#81C784', '#BA68C8', '#FF8A65', '#A1887F', '#90A4AE'];
  const usedNames = Object.values(players).map(p => p.nickname);
  const usedColors = Object.values(players).map(p => p.color);
  const name = botNames.find(n => !usedNames.includes(n)) || `Bot ${Object.keys(players).length}`;
  const color = botColors.find(c => !usedColors.includes(c)) || '#FF4FA3';

  const botUid = 'bot_' + Math.random().toString(36).slice(2, 10);
  await rtdbSet(`${BASE}/${code}/players/${botUid}`, {
    uid: botUid,
    nickname: name,
    color,
    isHost: false,
    isBot: true,
    botLevel,
    isOnline: true,
    joinedAt: Date.now(),
  });

  return botUid;
}

/**
 * Retire un joueur ou bot du salon (hôte uniquement).
 */
export async function kickPlayer(targetUid) {
  if (!currentCode) throw new Error('Pas de salon');
  const code = currentCode;

  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) throw new Error('Salon introuvable');
  if (meta.hostUid !== myUid) throw new Error('Seul l\'hôte peut retirer des joueurs');
  if (targetUid === myUid) throw new Error('Tu ne peux pas te retirer toi-même (utilise "Quitter")');

  const targetPlayer = await rtdbGet(`${BASE}/${code}/players/${targetUid}`);
  if (!targetPlayer) throw new Error('Joueur introuvable');

  if (targetPlayer.isBot) {
    // Bot : juste suppression
    await rtdbRemove(`${BASE}/${code}/players/${targetUid}`);
  } else {
    // Humain : ban temporaire pour qu'il sorte automatiquement
    await rtdbSet(`${BASE}/${code}/bans/${targetUid}`, {
      bannedAt: serverTimestamp(),
      bannedBy: myUid,
    });
    // Et on le retire des joueurs (le client banni détectera et fermera)
    await rtdbRemove(`${BASE}/${code}/players/${targetUid}`);
  }
}

/**
 * Transfère le rôle d'hôte à un autre joueur humain (hôte uniquement).
 */
export async function transferHost(targetUid) {
  if (!currentCode) throw new Error('Pas de salon');
  const code = currentCode;

  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) throw new Error('Salon introuvable');
  if (meta.hostUid !== myUid) throw new Error('Seul l\'hôte peut transférer le rôle');

  const target = await rtdbGet(`${BASE}/${code}/players/${targetUid}`);
  if (!target) throw new Error('Joueur introuvable');
  if (target.isBot) throw new Error('Un bot ne peut pas être hôte');

  // Transaction : update les flags
  const players = await rtdbGet(`${BASE}/${code}/players`) || {};
  const updates = {
    [`meta/hostUid`]: targetUid,
  };
  for (const uid of Object.keys(players)) {
    updates[`players/${uid}/isHost`] = (uid === targetUid);
  }
  await rtdbUpdate(`${BASE}/${code}`, updates);
}

/**
 * Modifie un paramètre de la config (hôte uniquement).
 */
export async function updateConfig(patch) {
  if (!currentCode) throw new Error('Pas de salon');
  const code = currentCode;

  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) throw new Error('Salon introuvable');
  if (meta.hostUid !== myUid) throw new Error('Seul l\'hôte peut configurer');

  // On update seulement les clés du patch
  const updates = {};
  for (const [k, v] of Object.entries(patch)) {
    updates[`config/${k}`] = v;
  }
  await rtdbUpdate(`${BASE}/${code}`, updates);
}

/**
 * Démarre la partie (hôte uniquement).
 */
export async function startGame() {
  if (!currentCode) throw new Error('Pas de salon');
  const code = currentCode;

  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) throw new Error('Salon introuvable');
  if (meta.hostUid !== myUid) throw new Error('Seul l\'hôte peut lancer la partie');

  const players = await rtdbGet(`${BASE}/${code}/players`) || {};
  const count = Object.keys(players).length;
  if (count < 4) throw new Error('4 joueurs minimum (ajoute des bots si besoin)');
  if (count > 8) throw new Error('8 joueurs maximum');

  const config = await rtdbGet(`${BASE}/${code}/config`);
  if (config?.gameMode !== 'cards') {
    throw new Error('Ce mode de jeu n\'est pas encore disponible');
  }

  await rtdbUpdate(`${BASE}/${code}/meta`, { status: 'playing' });
}

/**
 * S'abonne aux changements du salon courant.
 */
export function listenRoom(callback) {
  listeners.push(callback);
  if (currentRoom) callback(currentRoom);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

/**
 * Retourne l'état actuel du salon (snapshot synchrone).
 */
export function getRoom() {
  return currentRoom;
}

/**
 * Retourne l'UID du joueur courant.
 */
export function getMyUid() {
  return myUid;
}

/**
 * Détermine si le joueur courant est l'hôte.
 */
export function isHost() {
  if (!currentRoom) return false;
  return currentRoom.meta?.hostUid === myUid;
}

/**
 * Force la dissolution du salon (cleanup).
 */
export async function dissolveRoom() {
  if (currentCode) {
    try {
      await rtdbRemove(`${BASE}/${currentCode}`);
    } catch {}
  }
  cleanupLocal();
}

/**
 * Pour reconnecter à un salon existant après un refresh de la page.
 * Le code est passé en URL via le hash.
 */
export async function reconnectToRoom(code) {
  await ensureInitialized();
  code = code.toUpperCase();
  const meta = await rtdbGet(`${BASE}/${code}/meta`);
  if (!meta) return null;
  const players = await rtdbGet(`${BASE}/${code}/players`) || {};
  if (!players[myUid]) return null;

  // Update isOnline + lastSeen
  await rtdbUpdate(`${BASE}/${code}/players/${myUid}`, {
    isOnline: true,
    lastSeen: Date.now(),
  });
  rtdbOnDisconnect(`${BASE}/${code}/players/${myUid}/isOnline`, false);

  // Démarre le heartbeat
  startHeartbeat(code);

  currentCode = code;
  await subscribeToRoom(code);

  return { code, uid: myUid };
}
