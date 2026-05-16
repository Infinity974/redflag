/**
 * RedFlag — Constantes globales du jeu
 */

export const GAME_CONFIG = {
  // ---- Joueurs ----
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 8,

  // ---- Distribution de départ ----
  STARTING_HAND_SIZE: 6,
  STARTING_SHIELDS: 1,

  // ---- Jauges ----
  MAX_GAUGE: 100,
  MIN_GAUGE: -100,                 // Jauge peut désormais descendre en négatif
  DATE_IMMINENT_THRESHOLD: 100,
  DANGER_THRESHOLD: -100,          // Atteindre ≤ -100% met en danger

  // ---- Mécaniques ----
  CRITICAL_MULTIPLIER: 2,
  DOUBLE_CRITICAL_MULTIPLIER: 3,
  COMBO_TAG_BONUS: 10,

  // ---- Limite de flags sur le plateau ----
  // Si un joueur atteint MAX_RED_FLAGS_ON_BOARD red flags en jeu ET débute
  // son tour dans cet état → il est éliminé (même règle que le danger -100%).
  MAX_RED_FLAGS_ON_BOARD: 5,

  // ---- Taille du deck selon le nombre de joueurs ----
  // ~15 cartes par joueur pour que la partie dure 20-25 min.
  CARDS_PER_PLAYER: 15,

  // ---- Crush ----
  TRAITS_REVEAL_INTERVAL: 1,
  MAX_TRAITS_BEFORE_OVERTIME: 6,

  // ---- Ghosted ----
  GHOSTED_CARDS_OFFSET: -1,

  // ---- Nope ----
  NOPE_RESPONSE_WINDOW_MS: 3500,   // 3,5s pour jouer Nope (puis 3,5s par contre-Nope)

  // ---- Timings ----
  TURN_TIMEOUT_MS: 60000,
  CHAIN_RESPONSE_TIMEOUT_MS: 8000,
  GHOSTED_RESPONSE_TIMEOUT_MS: 10000,

  // ---- Animations ----
  CARD_PLAY_ANIMATION_MS: 900,     // Plus lent pour qu'on puisse lire
  CARD_TRANSIT_MS: 700,
  FLIP_ANIMATION_MS: 800,
  CRITICAL_FLASH_MS: 800,
  GHOSTED_REVEAL_MS: 1800,
  BOT_THINK_MS_MIN: 1800,          // Délai minimum entre 2 actions de bot
  BOT_THINK_MS_MAX: 3000,
  BOT_TURN_TIMEOUT_MS: 8000,       // Sécurité anti-freeze
};

// ---- Types de cartes ----
export const CARD_TYPES = {
  GREEN_FLAG: 'green_flag',
  RED_FLAG: 'red_flag',
  CONDITIONAL: 'conditional',
  ACTION: 'action',
  SHIELD: 'shield',
  DRAW: 'draw',
  GHOSTED: 'ghosted',
  CRUSH: 'crush',
  NOPE: 'nope',
  SKIP: 'skip',
};

// ---- Cibles possibles d'une carte ----
export const CARD_TARGETS = {
  SELF: 'self',
  CHOICE: 'choice',
  SELF_OR_CHOICE: 'self_or_choice',
  NEXT_PLAYER: 'next_player',
  ALL: 'all',
  ALL_OTHERS: 'all_others',
  DECK: 'deck',
  HAND: 'hand',
  NONE: 'none',                    // Pour Nope/Skip qui n'ont pas de cible explicite
};

// ---- États possibles d'une partie ----
export const GAME_STATUS = {
  WAITING: 'waiting',
  STARTING: 'starting',
  PLAYING: 'playing',
  CHAIN_ACTIVE: 'chain_active',
  GHOSTED_REVEAL: 'ghosted_reveal',
  DATE_IMMINENT: 'date_imminent',
  NOPE_WINDOW: 'nope_window',      // Fenêtre de Nope ouverte
  ENDED: 'ended',
};

// ---- Effets spéciaux des cartes Action ----
export const ACTION_EFFECTS = {
  PURGE_RED_FLAGS: 'purge_red_flags',
  PURGE_AND_BOOST: 'purge_and_boost',
  PURGE_AND_IMMUNITY: 'purge_and_immunity',
  STEAL_GREEN_FLAG: 'steal_green_flag',
  STEAL_AND_FORCE_DRAW: 'steal_and_force_draw',
  STEAL_AND_PLACE_RED: 'steal_and_place_red',
  STUN_NEXT_TURN: 'stun_next_turn',
  STUN_AND_DAMAGE: 'stun_and_damage',
  STUN_TWO_TARGETS: 'stun_two_targets',
  PEEK_DECK: 'peek_deck',
  PEEK_HAND: 'peek_hand',
  SKIP_DRAW: 'skip_draw',
  SUPER_SKIP: 'super_skip',        // Annule chaîne de pioche
  BLOCK: 'block',
  SHUFFLE_DECK: 'shuffle_deck',
  SWAP_HANDS: 'swap_hands',
  NOPE_LAST: 'nope_last',          // Annule la dernière action
  TRANSFORM_FLAG: 'transform_flag', // Subtilité : transforme un Red en Green
  TABLE_RASE: 'table_rase',        // Vide tous les flags d'une cible (board reset)

  // Cartes Exploding Kittens style
  SHUFFLE_CHOICE: 'shuffle_choice',     // Mélanger en choisissant 1ère et dernière carte
  FAVOR: 'favor',                       // Demander une carte (l'adversaire choisit)
  SEE_THE_FUTURE: 'see_the_future',     // Divination publique : 3 prochaines à tous
  ALTER_THE_FUTURE: 'alter_the_future', // Voir & réorganiser les 3 prochaines (privé)
  DRAW_FROM_BOTTOM: 'draw_from_bottom', // Pioche depuis le fond du deck
};

