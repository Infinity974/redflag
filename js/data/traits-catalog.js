/**
 * RedFlag — Catalogue des traits du Crush
 *
 * Structure :
 * - 20 Traits Principaux, chacun avec 3-4 Sous-Traits
 * - Tirage 100% aléatoire pour respecter l'égalité (cf GDD section 8)
 * - Affinité = ce que le Crush AIME (boost les Green Flags qui matchent)
 * - Aversion = ce que le Crush DÉTESTE (critique les Red Flags qui matchent,
 *              et fait flipper les Green Flags qui matchent en Red Flags)
 */

export const TRAIT_TYPES = {
  PRINCIPAL: 'principal',
  SUBTRAIT: 'subtrait',
};

export const TRAITS_CATALOG = {

  // ========== 1. AIME LES ANIMAUX ==========
  ANIMAL_LOVER: {
    id: 'ANIMAL_LOVER',
    displayName: 'Aime les animaux',
    emoji: '🐾',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['TEAM_CATS', 'TEAM_DOGS', 'ALLERGIC_FUR', 'VEGAN_ANIMAL'],
    affinity: ['#Animaux', '#Empathie', '#Tendre'],
    aversion: ['#AllergiquePoils'],
  },
  TEAM_CATS: {
    id: 'TEAM_CATS', displayName: 'Team Chats', emoji: '🐱',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ANIMAL_LOVER',
    affinity: ['#Chats'], aversion: ['#Chiens'],
  },
  TEAM_DOGS: {
    id: 'TEAM_DOGS', displayName: 'Team Chiens', emoji: '🐕',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ANIMAL_LOVER',
    affinity: ['#Chiens'], aversion: ['#Chats'],
  },
  ALLERGIC_FUR: {
    id: 'ALLERGIC_FUR', displayName: 'Allergique aux poils', emoji: '🤧',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ANIMAL_LOVER',
    affinity: [], aversion: ['#Chats', '#Chiens', '#AllergiquePoils'],
  },
  VEGAN_ANIMAL: {
    id: 'VEGAN_ANIMAL', displayName: 'Vegan engagé', emoji: '🌱',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ANIMAL_LOVER',
    affinity: ['#Vegan', '#Écolo'], aversion: ['#Carnivore'],
  },

  // ========== 2. FAMILLE D'ABORD ==========
  FAMILY_FIRST: {
    id: 'FAMILY_FIRST', displayName: "Famille d'abord", emoji: '👨‍👩‍👧',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['WANTS_KIDS', 'HATES_INLAWS', 'TRADITION'],
    affinity: ['#Famille', '#Engagement', '#Tendre'],
    aversion: ['#Indépendance'],
  },
  WANTS_KIDS: {
    id: 'WANTS_KIDS', displayName: 'Veut 4 enfants vite', emoji: '👶',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FAMILY_FIRST',
    affinity: ['#Famille', '#Romantique'], aversion: ['#Carrière', '#Liberté'],
  },
  HATES_INLAWS: {
    id: 'HATES_INLAWS', displayName: 'Déteste sa belle-famille', emoji: '😬',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FAMILY_FIRST',
    affinity: ['#Indépendance'], aversion: ['#Famille', '#Sentimental'],
  },
  TRADITION: {
    id: 'TRADITION', displayName: 'Tradition = sacré', emoji: '🕯️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FAMILY_FIRST',
    affinity: ['#Famille', '#Spiritualité'], aversion: ['#Aventurier'],
  },

  // ========== 3. CARRIÉRISTE ==========
  CAREER: {
    id: 'CAREER', displayName: 'Carriériste', emoji: '💼',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['WORKAHOLIC', 'FINANCIAL_INDEP', 'NO_KIDS'],
    affinity: ['#Carrière', '#Ambitieux', '#Indépendance'],
    aversion: ['#Casanier'],
  },
  WORKAHOLIC: {
    id: 'WORKAHOLIC', displayName: 'Workaholic', emoji: '🌙',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'CAREER',
    affinity: ['#Carrière', '#Routinier'], aversion: ['#Fêtard', '#Hédoniste'],
  },
  FINANCIAL_INDEP: {
    id: 'FINANCIAL_INDEP', displayName: 'Indépendance financière', emoji: '💰',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'CAREER',
    affinity: ['#Économe', '#Argent'], aversion: ['#Dépensier', '#Radin'],
  },
  NO_KIDS: {
    id: 'NO_KIDS', displayName: 'Anti-enfants', emoji: '🚫',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'CAREER',
    affinity: ['#Liberté', '#Indépendance'], aversion: ['#Famille'],
  },

  // ========== 4. ÉCOLO ==========
  ECOLO: {
    id: 'ECOLO', displayName: 'Écolo', emoji: '🌱',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['STRICT_VEGAN', 'NO_CAR', 'ZERO_WASTE'],
    affinity: ['#Écolo', '#Vegan', '#Bio'],
    aversion: ['#Carnivore', '#Anti-Écolo', '#Matérialiste'],
  },
  STRICT_VEGAN: {
    id: 'STRICT_VEGAN', displayName: 'Vegan strict', emoji: '🥦',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ECOLO',
    affinity: ['#Vegan'], aversion: ['#Carnivore', '#Bouffe'],
  },
  NO_CAR: {
    id: 'NO_CAR', displayName: 'Anti-voiture', emoji: '🚲',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ECOLO',
    affinity: ['#Écolo'], aversion: ['#Anti-Écolo'],
  },
  ZERO_WASTE: {
    id: 'ZERO_WASTE', displayName: 'Zéro déchet', emoji: '♻️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ECOLO',
    affinity: ['#Économe', '#Bio'], aversion: ['#Dépensier', '#Matérialiste'],
  },

  // ========== 5. FÊTARD ==========
  PARTY: {
    id: 'PARTY', displayName: 'Fêtard', emoji: '🎉',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['CLUB_WEEKLY', 'SOFT_DRUGS', 'HOUSE_PARTIES'],
    affinity: ['#Fêtard', '#Hédoniste', '#Sociable'],
    aversion: ['#Casanier', '#Spiritualité'],
  },
  CLUB_WEEKLY: {
    id: 'CLUB_WEEKLY', displayName: 'Boîte tous les week-ends', emoji: '🪩',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'PARTY',
    affinity: ['#Fêtard'], aversion: ['#Routinier', '#Casanier'],
  },
  SOFT_DRUGS: {
    id: 'SOFT_DRUGS', displayName: 'Drogues douces ok', emoji: '🌿',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'PARTY',
    affinity: ['#Hédoniste', '#Liberté'], aversion: ['#Maniaque'],
  },
  HOUSE_PARTIES: {
    id: 'HOUSE_PARTIES', displayName: 'Soirées chez soi', emoji: '🏠',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'PARTY',
    affinity: ['#Sociable', '#Domestique'], aversion: ['#Public'],
  },

  // ========== 6. CASANIER ==========
  HOMEBODY: {
    id: 'HOMEBODY', displayName: 'Casanier', emoji: '🏠',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['NETFLIX_ONLY', 'HOME_COOKING', 'ANTI_OUTING'],
    affinity: ['#Casanier', '#Domestique', '#Calme'],
    aversion: ['#Fêtard', '#Aventurier'],
  },
  NETFLIX_ONLY: {
    id: 'NETFLIX_ONLY', displayName: 'Netflix obligatoire', emoji: '📺',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'HOMEBODY',
    affinity: ['#Casanier', '#Cinéphile'], aversion: ['#Aventurier'],
  },
  HOME_COOKING: {
    id: 'HOME_COOKING', displayName: 'Cuisine maison', emoji: '🍲',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'HOMEBODY',
    affinity: ['#Cuisine', '#Domestique'], aversion: ['#Foodie'],
  },
  ANTI_OUTING: {
    id: 'ANTI_OUTING', displayName: 'Anti-sortie', emoji: '🚪',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'HOMEBODY',
    affinity: ['#Introverti', '#Privé'], aversion: ['#Public', '#Sociable'],
  },

  // ========== 7. SPIRITUEL ==========
  SPIRITUAL: {
    id: 'SPIRITUAL', displayName: 'Spirituel', emoji: '🧘',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['YOGA_MEDIT', 'ASTRO', 'RELIGIOUS'],
    affinity: ['#Spiritualité', '#Calme'],
    aversion: ['#Cynique', '#Fêtard'],
  },
  YOGA_MEDIT: {
    id: 'YOGA_MEDIT', displayName: 'Yoga & méditation', emoji: '🕉️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SPIRITUAL',
    affinity: ['#Spiritualité', '#Sportif'], aversion: ['#Hédoniste'],
  },
  ASTRO: {
    id: 'ASTRO', displayName: 'Astrologie', emoji: '🔮',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SPIRITUAL',
    affinity: ['#Spiritualité', '#Sensible'], aversion: ['#Cynique'],
  },
  RELIGIOUS: {
    id: 'RELIGIOUS', displayName: 'Religion pratiquante', emoji: '⛪',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SPIRITUAL',
    affinity: ['#Spiritualité', '#Famille'], aversion: ['#Hédoniste'],
  },

  // ========== 8. SPORTIF ==========
  SPORTY: {
    id: 'SPORTY', displayName: 'Sportif', emoji: '💪',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['CROSSFIT', 'RUNNING_ZEN', 'TEAM_SPORTS'],
    affinity: ['#Sportif', '#Maniaque'],
    aversion: ['#Sédentaire', '#Fêtard'],
  },
  CROSSFIT: {
    id: 'CROSSFIT', displayName: 'Crossfit hardcore', emoji: '🏋️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SPORTY',
    affinity: ['#Sportif', '#Ambitieux'], aversion: ['#Hédoniste'],
  },
  RUNNING_ZEN: {
    id: 'RUNNING_ZEN', displayName: 'Running zen', emoji: '🏃',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SPORTY',
    affinity: ['#Sportif', '#Calme'], aversion: ['#Fêtard'],
  },
  TEAM_SPORTS: {
    id: 'TEAM_SPORTS', displayName: 'Sport collectif', emoji: '⚽',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SPORTY',
    affinity: ['#Sportif', '#Sociable'], aversion: ['#Introverti'],
  },

  // ========== 9. GEEK ==========
  GEEK: {
    id: 'GEEK', displayName: 'Geek', emoji: '🎮',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['PRO_GAMING', 'ANIME_LIFE', 'SCIFI_FAN'],
    affinity: ['#Geek', '#Tech', '#Intellect'],
    aversion: ['#Sportif', '#Public'],
  },
  PRO_GAMING: {
    id: 'PRO_GAMING', displayName: 'Gaming pro', emoji: '🕹️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'GEEK',
    affinity: ['#Geek', '#Tech'], aversion: ['#Sportif', '#Sociable'],
  },
  ANIME_LIFE: {
    id: 'ANIME_LIFE', displayName: 'Anime à fond', emoji: '🎌',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'GEEK',
    affinity: ['#Geek', '#Créatif'], aversion: ['#Cynique'],
  },
  SCIFI_FAN: {
    id: 'SCIFI_FAN', displayName: 'Sci-fi life', emoji: '🚀',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'GEEK',
    affinity: ['#Geek', '#Cinéphile', '#Intellect'], aversion: ['#Sentimental'],
  },

  // ========== 10. MODE ==========
  FASHION: {
    id: 'FASHION', displayName: 'Mode-conscient', emoji: '👗',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['LUXURY', 'VINTAGE_HUNTER', 'STREETWEAR'],
    affinity: ['#BeautyHolic', '#Public', '#Charisme'],
    aversion: ['#Bordélique'],
  },
  LUXURY: {
    id: 'LUXURY', displayName: 'Luxe assumé', emoji: '💎',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FASHION',
    affinity: ['#Matérialiste', '#Dépensier'], aversion: ['#Économe', '#Écolo'],
  },
  VINTAGE_HUNTER: {
    id: 'VINTAGE_HUNTER', displayName: 'Vintage chineur', emoji: '🕶️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FASHION',
    affinity: ['#Économe', '#Créatif'], aversion: ['#Matérialiste'],
  },
  STREETWEAR: {
    id: 'STREETWEAR', displayName: 'Streetwear', emoji: '👟',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FASHION',
    affinity: ['#Public', '#Charisme'], aversion: ['#Privé'],
  },

  // ========== 11. BORDÉLIQUE ==========
  MESSY: {
    id: 'MESSY', displayName: 'Bordélique', emoji: '🌪️',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['DIRTY_DISHES', 'NO_PLAN', 'CHAOTIC'],
    affinity: ['#Bordélique', '#Spontané'],
    aversion: ['#Maniaque', '#Routinier'],
  },
  DIRTY_DISHES: {
    id: 'DIRTY_DISHES', displayName: 'Vaisselle qui traîne', emoji: '🍽️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'MESSY',
    affinity: ['#Bordélique'], aversion: ['#Domestique', '#Maniaque'],
  },
  NO_PLAN: {
    id: 'NO_PLAN', displayName: 'Pas de planning', emoji: '🤷',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'MESSY',
    affinity: ['#Spontané', '#Liberté'], aversion: ['#Routinier'],
  },
  CHAOTIC: {
    id: 'CHAOTIC', displayName: 'Spontané chaotique', emoji: '⚡',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'MESSY',
    affinity: ['#Spontané', '#Aventurier'], aversion: ['#Maniaque'],
  },

  // ========== 12. MANIAQUE ==========
  TIDY: {
    id: 'TIDY', displayName: 'Maniaque', emoji: '✨',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['LABEL_EVERYTHING', 'STRICT_ROUTINE', 'EXTREME_HYGIENE'],
    affinity: ['#Maniaque', '#Domestique', '#Routinier'],
    aversion: ['#Bordélique'],
  },
  LABEL_EVERYTHING: {
    id: 'LABEL_EVERYTHING', displayName: 'Tout étiqueté', emoji: '🏷️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'TIDY',
    affinity: ['#Maniaque'], aversion: ['#Bordélique', '#Spontané'],
  },
  STRICT_ROUTINE: {
    id: 'STRICT_ROUTINE', displayName: 'Routine stricte', emoji: '⏰',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'TIDY',
    affinity: ['#Routinier', '#Ponctuel'], aversion: ['#Spontané'],
  },
  EXTREME_HYGIENE: {
    id: 'EXTREME_HYGIENE', displayName: 'Hygiène extrême', emoji: '🧴',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'TIDY',
    affinity: ['#Hygiène', '#Maniaque'], aversion: ['#Bordélique'],
  },

  // ========== 13. ROMANTIQUE ==========
  ROMANTIC: {
    id: 'ROMANTIC', displayName: 'Romantique', emoji: '💐',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['LOVE_LETTERS', 'CONSTANT_SURPRISES', 'BIRTHDAY_SACRED'],
    affinity: ['#Romantique', '#Tendre', '#Sentimental'],
    aversion: ['#Cynique', '#Toxique'],
  },
  LOVE_LETTERS: {
    id: 'LOVE_LETTERS', displayName: "Lettres d'amour", emoji: '💌',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ROMANTIC',
    affinity: ['#Romantique', '#Créatif'], aversion: ['#Cynique'],
  },
  CONSTANT_SURPRISES: {
    id: 'CONSTANT_SURPRISES', displayName: 'Surprises constantes', emoji: '🎁',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ROMANTIC',
    affinity: ['#Romantique', '#Spontané'], aversion: ['#Cynique', '#Routinier'],
  },
  BIRTHDAY_SACRED: {
    id: 'BIRTHDAY_SACRED', displayName: 'Anniv = sacré', emoji: '🎂',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ROMANTIC',
    affinity: ['#Romantique', '#Famille'], aversion: ['#Cynique'],
  },

  // ========== 14. CYNIQUE ==========
  CYNIC: {
    id: 'CYNIC', displayName: 'Cynique', emoji: '🖤',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['ANTI_MARRIAGE', 'CALCULATING', 'SARCASTIC'],
    affinity: ['#Cynique', '#Indépendance'],
    aversion: ['#Romantique', '#Sentimental', '#Tendre'],
  },
  ANTI_MARRIAGE: {
    id: 'ANTI_MARRIAGE', displayName: 'Anti-mariage', emoji: '💔',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'CYNIC',
    affinity: ['#Liberté'], aversion: ['#Engagement', '#Famille'],
  },
  CALCULATING: {
    id: 'CALCULATING', displayName: '"Tout est calculé"', emoji: '🧮',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'CYNIC',
    affinity: ['#Cynique', '#Mature'], aversion: ['#Romantique'],
  },
  SARCASTIC: {
    id: 'SARCASTIC', displayName: 'Sarcastique pro', emoji: '😏',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'CYNIC',
    affinity: ['#Cynique', '#Charisme'], aversion: ['#Sensible'],
  },

  // ========== 15. AVENTURIER ==========
  ADVENTURER: {
    id: 'ADVENTURER', displayName: 'Aventurier', emoji: '🌍',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['SOLO_TRAVEL', 'EXTREME_SPORTS', 'DIGITAL_NOMAD'],
    affinity: ['#Aventurier', '#Liberté', '#Spontané'],
    aversion: ['#Casanier', '#Routinier'],
  },
  SOLO_TRAVEL: {
    id: 'SOLO_TRAVEL', displayName: 'Voyage solo', emoji: '🎒',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ADVENTURER',
    affinity: ['#Aventurier', '#Indépendance'], aversion: ['#Famille'],
  },
  EXTREME_SPORTS: {
    id: 'EXTREME_SPORTS', displayName: 'Sports extrêmes', emoji: '🪂',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ADVENTURER',
    affinity: ['#Aventurier', '#Sportif'], aversion: ['#Casanier'],
  },
  DIGITAL_NOMAD: {
    id: 'DIGITAL_NOMAD', displayName: 'Nomade digital', emoji: '💻',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ADVENTURER',
    affinity: ['#Aventurier', '#Tech', '#Liberté'], aversion: ['#Routinier'],
  },

  // ========== 16. FOODIE ==========
  FOODIE: {
    id: 'FOODIE', displayName: 'Foodie', emoji: '🍽️',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['MICHELIN', 'HOME_CHEF', 'STREET_FOOD'],
    affinity: ['#Foodie', '#Bouffe', '#Hédoniste'],
    aversion: ['#Économe'],
  },
  MICHELIN: {
    id: 'MICHELIN', displayName: 'Resto étoilé', emoji: '⭐',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FOODIE',
    affinity: ['#Foodie', '#Dépensier'], aversion: ['#Radin', '#Économe'],
  },
  HOME_CHEF: {
    id: 'HOME_CHEF', displayName: 'Chef à la maison', emoji: '👨‍🍳',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FOODIE',
    affinity: ['#Cuisine', '#Domestique'], aversion: [],
  },
  STREET_FOOD: {
    id: 'STREET_FOOD', displayName: 'Street food', emoji: '🌮',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'FOODIE',
    affinity: ['#Foodie', '#Aventurier'], aversion: ['#Maniaque'],
  },

  // ========== 17. ANTI-TECH ==========
  ANTI_TECH: {
    id: 'ANTI_TECH', displayName: 'Anti-tech', emoji: '📵',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['BASIC_PHONE', 'NO_SOCIAL', 'DIGITAL_DETOX'],
    affinity: ['#Antitech', '#Détox', '#Calme'],
    aversion: ['#Tech', '#Réseaux', '#Geek'],
  },
  BASIC_PHONE: {
    id: 'BASIC_PHONE', displayName: 'Téléphone basic', emoji: '☎️',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ANTI_TECH',
    affinity: ['#Antitech'], aversion: ['#Tech', '#Réseaux'],
  },
  NO_SOCIAL: {
    id: 'NO_SOCIAL', displayName: 'Pas de réseaux', emoji: '🚫',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ANTI_TECH',
    affinity: ['#Privé', '#Détox'], aversion: ['#Réseaux', '#Public'],
  },
  DIGITAL_DETOX: {
    id: 'DIGITAL_DETOX', displayName: 'Détox digital', emoji: '🌳',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'ANTI_TECH',
    affinity: ['#Détox', '#Calme', '#Spiritualité'], aversion: ['#Tech'],
  },

  // ========== 18. HYPER-SOCIAL ==========
  SUPER_SOCIAL: {
    id: 'SUPER_SOCIAL', displayName: 'Hyper-social', emoji: '🎤',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['ALWAYS_OUT', 'PRO_NETWORKER', 'HOST_PARTIES'],
    affinity: ['#Sociable', '#Charisme', '#Public'],
    aversion: ['#Introverti'],
  },
  ALWAYS_OUT: {
    id: 'ALWAYS_OUT', displayName: 'Toujours entouré', emoji: '👥',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SUPER_SOCIAL',
    affinity: ['#Sociable', '#Fêtard'], aversion: ['#Introverti'],
  },
  PRO_NETWORKER: {
    id: 'PRO_NETWORKER', displayName: 'Networking pro', emoji: '🤝',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SUPER_SOCIAL',
    affinity: ['#Sociable', '#Carrière'], aversion: ['#Privé'],
  },
  HOST_PARTIES: {
    id: 'HOST_PARTIES', displayName: 'Fêtes maison', emoji: '🥳',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'SUPER_SOCIAL',
    affinity: ['#Sociable', '#Domestique'], aversion: ['#Introverti'],
  },

  // ========== 19. INTROVERTI ==========
  INTROVERT: {
    id: 'INTROVERT', displayName: 'Introverti', emoji: '🦔',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['SOLO_NIGHTS', 'FEW_FRIENDS', 'ANTI_CROWDS'],
    affinity: ['#Introverti', '#Privé', '#Calme'],
    aversion: ['#Sociable', '#Public'],
  },
  SOLO_NIGHTS: {
    id: 'SOLO_NIGHTS', displayName: 'Soirée seul', emoji: '🌙',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'INTROVERT',
    affinity: ['#Casanier', '#Privé'], aversion: ['#Sociable', '#Fêtard'],
  },
  FEW_FRIENDS: {
    id: 'FEW_FRIENDS', displayName: 'Peu d\'amis proches', emoji: '👤',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'INTROVERT',
    affinity: ['#Loyal', '#Privé'], aversion: ['#Sociable'],
  },
  ANTI_CROWDS: {
    id: 'ANTI_CROWDS', displayName: 'Anti-foule', emoji: '🚪',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'INTROVERT',
    affinity: ['#Privé', '#Calme'], aversion: ['#Public', '#Fêtard'],
  },

  // ========== 20. HÉDONISTE ==========
  HEDONIST: {
    id: 'HEDONIST', displayName: 'Hédoniste', emoji: '🍷',
    type: TRAIT_TYPES.PRINCIPAL,
    subtraits: ['IMMEDIATE_PLEASURE', 'ANTI_ROUTINE', 'CARPE_DIEM'],
    affinity: ['#Hédoniste', '#Foodie', '#Spontané'],
    aversion: ['#Routinier', '#Économe', '#Maniaque'],
  },
  IMMEDIATE_PLEASURE: {
    id: 'IMMEDIATE_PLEASURE', displayName: 'Plaisirs immédiats', emoji: '🍰',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'HEDONIST',
    affinity: ['#Hédoniste', '#Dépensier'], aversion: ['#Économe'],
  },
  ANTI_ROUTINE: {
    id: 'ANTI_ROUTINE', displayName: 'Anti-routine', emoji: '🎲',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'HEDONIST',
    affinity: ['#Spontané', '#Aventurier'], aversion: ['#Routinier'],
  },
  CARPE_DIEM: {
    id: 'CARPE_DIEM', displayName: 'Carpe diem', emoji: '🌅',
    type: TRAIT_TYPES.SUBTRAIT, parentId: 'HEDONIST',
    affinity: ['#Hédoniste', '#Liberté'], aversion: ['#Cynique'],
  },
};

/**
 * Helper : récupère un trait par son ID.
 */
export function getTrait(id) {
  return TRAITS_CATALOG[id] || null;
}

/**
 * Retourne tous les traits principaux (sans les sous-traits).
 */
export function getAllPrincipalTraits() {
  return Object.values(TRAITS_CATALOG).filter(t => t.type === TRAIT_TYPES.PRINCIPAL);
}

/**
 * Retourne les sous-traits d'un trait principal.
 */
export function getSubtraitsOf(principalId) {
  const principal = TRAITS_CATALOG[principalId];
  if (!principal || !principal.subtraits) return [];
  return principal.subtraits.map(id => TRAITS_CATALOG[id]).filter(Boolean);
}
