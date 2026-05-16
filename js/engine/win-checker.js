/**
 * RedFlag — Win Checker
 *
 * Vérifie les conditions de victoire et de défaite après chaque action.
 */

import { GAME_CONFIG, GAME_STATUS } from '../config/game-constants.js';

/**
 * Vérifie si un joueur déclenche le statut DATE IMMINENT (atteint 100%).
 */
export function checkDateImminent(gameState, playerUid) {
  const player = gameState.players[playerUid];
  if (!player || player.isGhosted) return false;
  return player.profile.seductionGauge >= GAME_CONFIG.DATE_IMMINENT_THRESHOLD;
}

/**
 * Vérifie si le joueur en DATE IMMINENT a survécu un tour de table complet.
 *
 * Logique : on enregistre le numéro du tour où le joueur a atteint 100%.
 * S'il revient à son tour suivant tout en étant toujours à 100%, il gagne.
 */
export function checkDateImminentSurvival(gameState) {
  const dateImminentInfo = gameState.dateImminent;
  if (!dateImminentInfo) return null;

  const { playerUid, startedAtTurn } = dateImminentInfo;
  const player = gameState.players[playerUid];

  // Le joueur a chuté sous 100% → l'état Date Imminent disparaît
  if (!player || player.profile.seductionGauge < GAME_CONFIG.DATE_IMMINENT_THRESHOLD) {
    // Reset l'état
    gameState.dateImminent = null;
    return { event: 'date_imminent_broken', playerUid };
  }

  const playerCount = Object.values(gameState.players).filter(p => !p.isGhosted).length;
  const turnsSinceStart = (gameState.turn.turnNumber || 0) - startedAtTurn;

  // Quand son propre tour revient (tour de table complet écoulé) ET qu'il est toujours à 100%
  if (turnsSinceStart >= playerCount && gameState.turn.activePlayerUid === playerUid) {
    return { event: 'victory_by_date', playerUid };
  }

  return null;
}

/**
 * Marque un joueur comme Ghosté (éliminé) après pioche fatale sans bouclier.
 * Vérifie automatiquement si la partie doit se terminer.
 */
export function markPlayerAsGhosted(gameState, playerUid) {
  const player = gameState.players[playerUid];
  if (!player) return null;

  player.isGhosted = true;
  player.profile.activeFlags = []; // On nettoie son profil

  // Génère son SMS de rupture
  const sms = generateBreakupSMS(player);

  // ⚠️ Vérifie si la partie se termine (dernier survivant, etc.)
  const endCheck = checkGameEnd(gameState);
  if (endCheck && endCheck.event === 'victory_by_survivor') {
    gameState.status = 'ended';
    gameState.winner = endCheck.playerUid;
    gameState.endReason = 'last_survivor';
  } else if (endCheck && endCheck.event === 'all_ghosted') {
    gameState.status = 'ended';
    gameState.winner = null;
    gameState.endReason = 'all_ghosted';
  }

  return {
    event: 'player_ghosted',
    playerUid,
    nickname: player.nickname,
    breakupSMS: sms,
    gameEnded: gameState.status === 'ended',
    finalWinner: gameState.winner,
  };
}

/**
 * Vérifie s'il ne reste qu'un seul joueur non-Ghosté → victoire alternative.
 */
export function checkLastSurvivor(gameState) {
  const aliveUids = Object.values(gameState.players)
    .filter(p => !p.isGhosted)
    .map(p => p.uid);

  if (aliveUids.length === 1) {
    return { event: 'victory_by_survivor', playerUid: aliveUids[0] };
  }

  if (aliveUids.length === 0) {
    return { event: 'all_ghosted', playerUid: null };
  }

  return null;
}

/**
 * Vérifie si la partie doit se terminer pour une raison ou une autre.
 * Retourne null si la partie continue.
 */
export function checkGameEnd(gameState) {
  // 1. Survivant unique
  const survivor = checkLastSurvivor(gameState);
  if (survivor) return survivor;

  // 2. Date Imminent survécu
  const dateImminent = checkDateImminentSurvival(gameState);
  if (dateImminent && dateImminent.event === 'victory_by_date') {
    return dateImminent;
  }

  return null;
}

/**
 * Génère un SMS de rupture personnalisé à partir des pires flags du joueur.
 * Le coup de viralité du jeu.
 */
export function generateBreakupSMS(player) {
  const allFlags = player.profile.activeFlags || [];
  const redFlags = allFlags.filter(f => f.type === 'red');

  // Trie par valeur la plus négative en premier (les pires flags)
  const worstFlags = redFlags
    .sort((a, b) => a.value - b.value)
    .slice(0, 2);

  const intros = [
    `Hey ${player.nickname},`,
    `Salut ${player.nickname}...`,
    `${player.nickname}, faut qu'on parle.`,
    `Coucou ${player.nickname},`,
  ];

  const closings = [
    "j'ai trouvé mieux 💅",
    "c'est pas toi c'est moi (en fait si c'est toi)",
    "je préfère qu'on en reste là 🥲",
    "bonne continuation 👋",
    "garde la pêche ✌️",
  ];

  const intro = intros[Math.floor(Math.random() * intros.length)];
  const closing = closings[Math.floor(Math.random() * closings.length)];

  if (worstFlags.length === 0) {
    return `${intro} ça matchait pas, ${closing}`;
  }

  if (worstFlags.length === 1) {
    return `${intro} t'étais sympa mais... ${flagToSentence(worstFlags[0])}. ${closing}`;
  }

  return `${intro} t'étais sympa mais entre ${flagToSentence(worstFlags[0])} et ${flagToSentence(worstFlags[1])}... ${closing}`;
}

/**
 * Convertit un flag en bout de phrase utilisable dans le SMS.
 * Ex: { name: "Mayo sur Sushi" } → "le fait que tu mettes de la mayo sur les sushis"
 *
 * Pour la V1 on prend juste le nom de la carte en lowercase.
 */
function flagToSentence(flag) {
  const name = (flag.cardName || flag.cardCode || 'ça').toLowerCase();
  return `tes "${name}"`;
}
