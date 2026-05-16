/**
 * RedFlag — Service de salon local (sans Firebase)
 *
 * Simule un salon multijoueur en mémoire, persisté dans sessionStorage.
 * Quand tu seras prêt à passer en multijoueur réel (Firebase), on remplacera
 * ce service par rooms-service.js (l'API est compatible).
 *
 * Le salon contient :
 *   - meta : code, hostUid, status, createdAt
 *   - players : { uid -> { uid, nickname, color, isHost, isBot, botLevel, joinedAt } }
 *   - config : { gameMode, botLevel, traitsAtStart, gameSpeed, maxRedFlags, nopeEnabled }
 *
 * Note : ce service ne fait QUE de l'état local. Pas de réseau, pas de
 * Cloud Functions. Le "salon" est dans la mémoire du navigateur.
 */

const STORAGE_KEY = 'redflag_local_room';

const DEFAULT_CONFIG = {
  gameMode: 'cards',           // 'cards' | 'mode2' | 'mode3'
  botLevel: 'normal',          // 'easy' | 'normal' | 'hard'
  traitsAtStart: 1,            // 1 | 2 | 3
  gameSpeed: 'normal',         // 'fast' | 'normal' | 'long'
  maxRedFlags: 5,              // 3 | 4 | 5
  nopeEnabled: true,           // bool
};

// === État en mémoire ===
let currentRoom = null;
let listeners = [];

// Récupère l'UID du joueur courant (générée et stockée dans localStorage)
function getMyUid() {
  let uid = localStorage.getItem('redflag_local_uid');
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('redflag_local_uid', uid);
  }
  return uid;
}

// Génère un code de salon à 4 caractères (pas de O, 0, I, 1 pour clarté visuelle)
function generateRoomCode() {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

// Persiste l'état actuel
function save() {
  if (currentRoom) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentRoom));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

// Restaure depuis sessionStorage (si on rafraîchit la page par exemple)
function restore() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      currentRoom = JSON.parse(raw);
    } catch {
      currentRoom = null;
    }
  }
}
restore();

// Notifie les listeners qu'il y a eu un changement
function notify() {
  save();
  for (const cb of listeners) cb(currentRoom);
}

/**
 * Crée un salon local. Le créateur en devient l'hôte.
 *
 * @returns {{ code, uid }} le code généré + l'UID de l'hôte
 */
export async function createRoom({ nickname, color }) {
  const code = generateRoomCode();
  const hostUid = getMyUid();
  currentRoom = {
    meta: {
      code,
      hostUid,
      status: 'waiting',
      createdAt: Date.now(),
    },
    players: {
      [hostUid]: {
        uid: hostUid,
        nickname: nickname || 'Hôte',
        color: color || '#FF4FA3',
        isHost: true,
        isBot: false,
        joinedAt: Date.now(),
      },
    },
    config: { ...DEFAULT_CONFIG },
  };
  notify();
  return { code, uid: hostUid };
}

/**
 * "Rejoint" un salon. En mode local, ça fait pas grand-chose : on ne peut
 * pas vraiment rejoindre un salon créé par quelqu'un d'autre puisqu'il
 * n'existe que dans son navigateur.
 *
 * On lève une erreur si le salon n'existe pas en local.
 */
export async function joinRoom({ code, nickname, color }) {
  if (!currentRoom || currentRoom.meta.code !== code) {
    throw new Error('Salon introuvable. Pour le multi entre amis, il faudra activer Firebase.');
  }
  // Si on est déjà l'hôte (rechargement de page), on ne fait rien
  const myUid = getMyUid();
  if (currentRoom.players[myUid]) {
    return { code, uid: myUid };
  }
  currentRoom.players[myUid] = {
    uid: myUid,
    nickname: nickname || 'Joueur',
    color: color || '#FF4FA3',
    isHost: false,
    isBot: false,
    joinedAt: Date.now(),
  };
  notify();
  return { code, uid: myUid };
}

/**
 * Quitte le salon (le joueur courant se retire).
 * Si l'hôte quitte, le salon est dissous.
 */
export async function leaveRoom() {
  if (!currentRoom) return;
  const myUid = getMyUid();
  if (myUid === currentRoom.meta.hostUid) {
    // L'hôte quitte → on dissout le salon
    currentRoom = null;
  } else {
    delete currentRoom.players[myUid];
  }
  notify();
}

/**
 * Ajoute un bot au salon. Hôte uniquement.
 *
 * @param {string} botLevel - 'easy', 'normal' ou 'hard'
 */
export async function addBot(botLevel = 'normal') {
  if (!currentRoom) throw new Error('Pas de salon');
  const myUid = getMyUid();
  if (myUid !== currentRoom.meta.hostUid) throw new Error('Seul l\'hôte peut ajouter des bots');

  const playerCount = Object.keys(currentRoom.players).length;
  if (playerCount >= 8) throw new Error('Maximum 8 joueurs');

  // Génère un nom + couleur uniques
  const botNames = ['Bot Léo', 'Bot Maya', 'Bot Sam', 'Bot Zoé', 'Bot Théo', 'Bot Inès', 'Bot Hugo', 'Bot Lou'];
  const botColors = ['#FF6B9D', '#4FC3F7', '#FFD54F', '#81C784', '#BA68C8', '#FF8A65', '#A1887F', '#90A4AE'];
  const usedNames = Object.values(currentRoom.players).map(p => p.nickname);
  const usedColors = Object.values(currentRoom.players).map(p => p.color);
  const name = botNames.find(n => !usedNames.includes(n)) || `Bot ${playerCount}`;
  const color = botColors.find(c => !usedColors.includes(c)) || '#FF4FA3';

  const botUid = 'bot_' + Math.random().toString(36).slice(2, 10);
  currentRoom.players[botUid] = {
    uid: botUid,
    nickname: name,
    color,
    isHost: false,
    isBot: true,
    botLevel,
    joinedAt: Date.now(),
  };
  notify();
  return botUid;
}

/**
 * Retire un joueur ou un bot du salon. Hôte uniquement.
 * L'hôte ne peut pas se retirer lui-même via cette fonction.
 */
export async function kickPlayer(targetUid) {
  if (!currentRoom) throw new Error('Pas de salon');
  const myUid = getMyUid();
  if (myUid !== currentRoom.meta.hostUid) throw new Error('Seul l\'hôte peut retirer des joueurs');
  if (targetUid === myUid) throw new Error('Tu ne peux pas te retirer toi-même (utilise "Quitter")');
  if (!currentRoom.players[targetUid]) throw new Error('Joueur introuvable');
  delete currentRoom.players[targetUid];
  notify();
}

/**
 * Transfère le rôle d'hôte à un autre joueur (humain uniquement).
 */
export async function transferHost(targetUid) {
  if (!currentRoom) throw new Error('Pas de salon');
  const myUid = getMyUid();
  if (myUid !== currentRoom.meta.hostUid) throw new Error('Seul l\'hôte peut transférer le rôle');
  const target = currentRoom.players[targetUid];
  if (!target) throw new Error('Joueur introuvable');
  if (target.isBot) throw new Error('Un bot ne peut pas être hôte');

  // Met à jour les flags
  for (const p of Object.values(currentRoom.players)) {
    p.isHost = (p.uid === targetUid);
  }
  currentRoom.meta.hostUid = targetUid;
  notify();
}

/**
 * Modifie un paramètre de la config. Hôte uniquement.
 */
export async function updateConfig(patch) {
  if (!currentRoom) throw new Error('Pas de salon');
  const myUid = getMyUid();
  if (myUid !== currentRoom.meta.hostUid) throw new Error('Seul l\'hôte peut configurer');
  currentRoom.config = { ...currentRoom.config, ...patch };
  notify();
}

/**
 * Démarre la partie. Hôte uniquement.
 *
 * Vérifications :
 *   - 4 joueurs minimum (humains + bots confondus)
 *   - 8 joueurs maximum
 *   - Mode de jeu sélectionné jouable (seul 'cards' l'est pour l'instant)
 */
export async function startGame() {
  if (!currentRoom) throw new Error('Pas de salon');
  const myUid = getMyUid();
  if (myUid !== currentRoom.meta.hostUid) throw new Error('Seul l\'hôte peut lancer la partie');

  const count = Object.keys(currentRoom.players).length;
  if (count < 4) throw new Error('4 joueurs minimum (ajoute des bots si besoin)');
  if (count > 8) throw new Error('8 joueurs maximum');

  const mode = currentRoom.config.gameMode;
  if (mode !== 'cards') {
    throw new Error('Ce mode de jeu n\'est pas encore disponible');
  }

  currentRoom.meta.status = 'playing';
  notify();
}

/**
 * S'abonne aux changements du salon. La callback reçoit le salon entier
 * à chaque modification.
 */
export function listenRoom(callback) {
  listeners.push(callback);
  // Émet l'état actuel immédiatement
  if (currentRoom) callback(currentRoom);
  // Renvoie une fonction de désabonnement
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
export { getMyUid };

/**
 * Détermine si le joueur courant est l'hôte.
 */
export function isHost() {
  if (!currentRoom) return false;
  return currentRoom.meta.hostUid === getMyUid();
}

/**
 * Force la dissolution du salon (utile au cleanup).
 */
export function dissolveRoom() {
  currentRoom = null;
  notify();
}
