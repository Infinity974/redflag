/**
 * RedFlag — Utilitaires partagés
 */

/**
 * Mélange un tableau in-place (Fisher-Yates).
 * Retourne le même tableau pour permettre le chaînage.
 */
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Retourne une copie mélangée (n'altère pas l'original).
 */
export function shuffled(array) {
  return shuffle([...array]);
}

/**
 * Pioche N éléments aléatoires d'un tableau, sans les retirer.
 */
export function sampleN(array, n) {
  return shuffled(array).slice(0, n);
}

/**
 * Retourne un élément aléatoire d'un tableau.
 */
export function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Génère un identifiant unique court (pour les flags posés, les events, etc.)
 */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Génère un code de salon de 4 caractères (lettres + chiffres, sans ambiguïté).
 * Caractères évités : 0/O, 1/I, L (lettre L minuscule)
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Clamp une valeur entre min et max.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deep clone d'un objet (utilise structuredClone si dispo, sinon JSON).
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pause asynchrone (utile pour les animations).
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Avatar : génère une couleur aléatoire dans la palette du jeu.
 */
const AVATAR_COLORS = [
  '#FF4FA3', // pink
  '#9B4FFF', // purple
  '#4FC3FF', // cyan
  '#39FF6A', // green
  '#FFD93D', // gold
  '#FF6BB3', // pink-light
  '#E63946', // red
  '#9FE1CB', // mint
];

export function randomAvatarColor() {
  return randomFrom(AVATAR_COLORS);
}

export function getAvatarLetter(nickname) {
  return (nickname || '?').trim().charAt(0).toUpperCase();
}
