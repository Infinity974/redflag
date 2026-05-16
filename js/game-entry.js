/**
 * RedFlag — Game screen entry (SPA)
 *
 * Démarre la partie en mode SOLO (local) ou MULTI (Firebase) selon le contexte.
 *
 * Détection :
 *   - Si le salon vient de Firebase (room.meta.code à 4 chars + room-service en mode Firebase)
 *     → mode MULTI : utilise multiplayer-controller.js (architecture host/clients)
 *   - Sinon → mode SOLO : utilise game-controller.js (tout en local)
 *
 * Dans les 2 cas, les bots sont gérés par l'hôte de la partie.
 */

import { initUIScale } from './ui/ui-scaler.js';
import { showSimpleToast } from './settings.js';
import { navigateTo } from './app.js';
import { getRoom, getMyUid } from './services/room-service.js';

// Active le scaling fluide AVANT toute autre initialisation
initUIScale();

const handEl = document.getElementById('playerHand');
if (handEl) handEl.innerHTML = '';
const oppEl = document.getElementById('opponentsRow');
if (oppEl) oppEl.innerHTML = '';

/**
 * Détermine si on doit utiliser le mode multijoueur Firebase.
 */
async function shouldUseMultiplayer() {
  // Si on a `__REDFLAG_USE_FIREBASE` à false explicite, mode solo
  if (typeof window !== 'undefined' && window.__REDFLAG_USE_FIREBASE === false) {
    return false;
  }

  // Vérifie la présence de la config Firebase
  try {
    const { firebaseConfig } = await import('./services/firebase-config.js');
    if (!firebaseConfig?.apiKey || !firebaseConfig?.databaseURL) {
      return false;
    }
  } catch {
    return false;
  }

  // Vérifie que room-service est bien en mode Firebase
  try {
    const roomServiceMod = await import('./services/room-service-firebase.js');
    return !!roomServiceMod;
  } catch {
    return false;
  }
}

async function startFromContext() {
  const useMulti = await shouldUseMultiplayer();
  console.log('[game-entry] Mode:', useMulti ? 'MULTIJOUEUR' : 'SOLO');

  // Récupère les données du salon
  let players, config, myUid, roomCode;

  // Tente d'abord depuis le salon courant (room-service)
  for (let i = 0; i < 20; i++) {
    const room = getRoom();
    if (room && room.players && Object.keys(room.players).length > 0) {
      players = room.players;
      config = room.config;
      myUid = getMyUid();
      roomCode = room.meta?.code;
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Fallback : snapshot localStorage
  if (!players) {
    const raw = localStorage.getItem('redflag_local_game');
    if (raw) {
      try {
        const snap = JSON.parse(raw);
        players = snap.players;
        config = snap.config;
        myUid = snap.myUid;
      } catch (e) {
        console.warn('Snapshot localStorage invalide:', e);
      }
    }
  }

  if (!players || Object.keys(players).length === 0) {
    showSimpleToast('Aucune partie en cours, retour au menu', 'warning', 2500);
    navigateTo('home');
    return;
  }

  // Convertit la map en specs ordonnés
  const playerSpecs = Object.values(players)
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    .map(p => ({
      uid: p.uid,
      nickname: p.nickname,
      avatarColor: p.color,
      isBot: !!p.isBot,
    }));

  // Détermine l'hôte
  const hostUid = Object.values(players).find(p => p.isHost)?.uid || playerSpecs[0]?.uid;

  if (useMulti && roomCode) {
    // ===== MODE MULTI =====
    try {
      const { startMultiplayerGame } = await import('./controllers/multiplayer-controller.js');
      await startMultiplayerGame(roomCode, playerSpecs, {
        gameConfig: config || {},
        hostUid,
      });
    } catch (err) {
      console.error('Erreur démarrage multi:', err);
      showSimpleToast('Erreur multijoueur, mode solo activé', 'warning', 3000);
      await startSolo(playerSpecs, config, myUid);
    }
  } else {
    // ===== MODE SOLO =====
    await startSolo(playerSpecs, config, myUid);
  }
}

async function startSolo(playerSpecs, config, myUid) {
  const { startLocalGame } = await import('./controllers/game-controller.js');
  startLocalGame(
    playerSpecs.find(p => p.uid === myUid)?.nickname || 'Joueur',
    0,
    {
      playerSpecs,
      humanUid: myUid,
      difficulty: config?.botLevel || 'normal',
      gameConfig: config || {},
    }
  );
}

startFromContext().catch(err => {
  console.error('Erreur démarrage:', err);
  showSimpleToast('Erreur de démarrage', 'error', 3000);
  navigateTo('home');
});
