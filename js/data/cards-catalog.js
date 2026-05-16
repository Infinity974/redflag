/**
 * RedFlag — Catalogue des 100 cartes
 *
 * Format de carte :
 * {
 *   code: 'GF-01',              // Identifiant unique
 *   name: 'Mister Propre',      // Nom affiché
 *   emoji: '✨',                // Illustration emoji
 *   type: CARD_TYPES.GREEN_FLAG,// Type
 *   value: 15,                  // Valeur d'impact (% ou 0 pour actions)
 *   description: '...',         // Texte narratif
 *   displayedTags: ['#X', '#Y'],// Tags visibles côté joueur
 *   hiddenTags: [],             // Tags secrets (matching uniquement)
 *   target: CARD_TARGETS.X,     // Cible autorisée
 *   conditional: null,          // Pour les cartes conditionnelles
 *   actionEffect: null,         // Pour les cartes Action
 *   chainValue: 0,              // Pour les cartes Pioche
 * }
 */

import { CARD_TYPES, CARD_TARGETS, ACTION_EFFECTS } from '../config/game-constants.js';

export const CARDS_CATALOG = [

  // ========================================================================
  // 🟢 GREEN FLAGS (×25)
  // ========================================================================
  {
    code: 'GF-01', name: 'Mister Propre', emoji: '✨',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Fait le ménage sans qu'on lui demande, plinthes incluses.",
    displayedTags: ['#Maniaque', '#Domestique'], hiddenTags: ['#Hygiène'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-02', name: 'Biscuit le Golden', emoji: '🐕',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "A un chien qui répond mieux que la plupart des humains.",
    displayedTags: ['#Animaux', '#Chiens'], hiddenTags: ['#Tendre'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-03', name: 'Famille en Or', emoji: '👨‍👩‍👧',
    type: CARD_TYPES.GREEN_FLAG, value: 20,
    description: "Appelle sa mère le dimanche. Et elle décroche.",
    displayedTags: ['#Famille', '#Sentimental'], hiddenTags: ['#Tendre'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-04', name: 'Lecteur le Vrai', emoji: '📚',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Lit des vrais livres. Pas des résumés TikTok.",
    displayedTags: ['#Intellect', '#Calme'], hiddenTags: ['#Cultivé'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-05', name: 'Chef à la Maison', emoji: '🍳',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Sait reproduire les plats du restau. En mieux.",
    displayedTags: ['#Cuisine', '#Domestique'], hiddenTags: ['#Foodie'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-06', name: 'Mister Bricolage', emoji: '🔧',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "Répare la fuite avant qu'elle existe.",
    displayedTags: ['#Pratique', '#Domestique'], hiddenTags: ['#Mature'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-07', name: 'Discipline de Fer', emoji: '💪',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "5h30 du mat, gym, kale, pas une journée ratée.",
    displayedTags: ['#Sportif', '#Maniaque'], hiddenTags: ['#Routinier'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-08', name: "Âme d'Artiste", emoji: '🎨',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "Te peint quand tu dors. Romantique ou flippant.",
    displayedTags: ['#Créatif', '#Sensible'], hiddenTags: ['#Romantique'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-09', name: 'Texto Parfait', emoji: '💌',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "Répond en 3 minutes. Avec ponctuation. Qui fait ça.",
    displayedTags: ['#Communication', '#Mature'], hiddenTags: ['#Loyal'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-10', name: 'Green Thumb', emoji: '🌱',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Fait pousser ses tomates sur un balcon de 4m².",
    displayedTags: ['#Écolo', '#Patient'], hiddenTags: ['#Bio'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-11', name: 'Tonton Goat', emoji: '🧒',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Dévoué pour ses neveux. Construit des cabanes.",
    displayedTags: ['#Famille', '#Tendre'], hiddenTags: ['#Créatif'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-12', name: 'Zen Master', emoji: '🧘',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "Calme même quand le métro est en grève.",
    displayedTags: ['#Spiritualité', '#Calme'], hiddenTags: ['#Mature'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-13', name: 'Économe Sage', emoji: '💸',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Gère son budget sur un tableur. Et ça marche.",
    displayedTags: ['#Économe', '#Mature'], hiddenTags: ['#Pratique'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-14', name: 'Papa Chat', emoji: '🐱',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "3 chats. Tous adoptés. Tous nommés en latin.",
    displayedTags: ['#Animaux', '#Chats'], hiddenTags: ['#Tendre'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-15', name: 'Playlist Parfaite', emoji: '🎵',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "T'a fait découvrir 4 artistes en 1 soirée.",
    displayedTags: ['#Culture', '#Charisme'], hiddenTags: ['#Créatif'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-16', name: 'Globe-Trotter', emoji: '🌍',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "A vu le monde. Et a des histoires qui valent.",
    displayedTags: ['#Aventurier', '#Cultivé'], hiddenTags: ['#Liberté'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-17', name: "Raconteur d'Histoires", emoji: '📖',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "Les dîners durent 4h. Personne ne s'en plaint.",
    displayedTags: ['#Sociable', '#Charisme'], hiddenTags: ['#Cultivé'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-18', name: 'Garde-Malade Pro', emoji: '🏥',
    type: CARD_TYPES.GREEN_FLAG, value: 20,
    description: "Reste à ton chevet quand t'as la grippe. Avec soupe.",
    displayedTags: ['#Tendre', '#Loyal'], hiddenTags: ['#Empathie'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-19', name: 'Aide les Mamies', emoji: '👵',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Traverse les passages piétons mains liées.",
    displayedTags: ['#Empathie', '#Tendre'], hiddenTags: ['#Public'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-20', name: 'Sommelier Amateur', emoji: '🍷',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "Connaît la différence Bourgogne/Bordeaux.",
    displayedTags: ['#Foodie', '#Cultivé'], hiddenTags: ['#Hédoniste'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-21', name: 'Bosse son Empire', emoji: '💼',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Entrepreneur. Vraiment. Pas juste sur LinkedIn.",
    displayedTags: ['#Carrière', '#Ambitieux'], hiddenTags: ['#Indépendance'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-22', name: 'Cinéphile Vrai', emoji: '🎬',
    type: CARD_TYPES.GREEN_FLAG, value: 10,
    description: "Connaît Wong Kar-wai. Pas que Marvel.",
    displayedTags: ['#Cinéphile', '#Intellect'], hiddenTags: ['#Cultivé'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-23', name: 'Cycliste Quotidien', emoji: '🚲',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Vélo qu'il pleuve, vente ou neige.",
    displayedTags: ['#Écolo', '#Sportif'], hiddenTags: ['#Routinier'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-24', name: 'Adopte Pas Achète', emoji: '🐶',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "3 chats borgnes sauvés. La SPA le connaît.",
    displayedTags: ['#Animaux', '#Empathie'], hiddenTags: ['#Tendre'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },
  {
    code: 'GF-25', name: 'Petit-Déj au Lit', emoji: '☕',
    type: CARD_TYPES.GREEN_FLAG, value: 15,
    description: "Croissants chauds + jus pressé. Sans demande.",
    displayedTags: ['#Romantique', '#Tendre'], hiddenTags: ['#Hédoniste'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
  },

  // ========================================================================
  // 🔴 RED FLAGS — Joueur Suivant (×17)
  // ========================================================================
  {
    code: 'RF-01', name: 'Le Claqueur de Doigts', emoji: '💅',
    type: CARD_TYPES.RED_FLAG, value: -20,
    description: "Claque des doigts pour appeler le serveur. À midi.",
    displayedTags: ['#Public', '#Arrogant'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-02', name: 'Odeur de Pieds', emoji: '🧦',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Dort en chaussettes. Les mêmes que la veille.",
    displayedTags: ['#Hygiène'], hiddenTags: ['#Domestique'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-03', name: 'Mayo sur Sushi', emoji: '🍣',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Met de la mayo sur ses makis. Et l'assume fort.",
    displayedTags: ['#Bouffe'], hiddenTags: ['#Foodie'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-04', name: 'Coupe la Parole', emoji: '🗣️',
    type: CARD_TYPES.RED_FLAG, value: -10,
    description: "Dans CHAQUE phrase. Te laisse jamais finir.",
    displayedTags: ['#Sociable', '#Égoïste'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-05', name: 'Scrolle Pendant Tu Parles', emoji: '📱',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Hoche la tête sans lever les yeux du tel.",
    displayedTags: ['#Tech', '#Égoïste'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-06', name: 'Klaxonne pour Tout', emoji: '🚗',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Dépasse. Klaxonne. Insulte. Recommence.",
    displayedTags: ['#Public'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-07', name: 'Pas de Brossage Matin', emoji: '🦷',
    type: CARD_TYPES.RED_FLAG, value: -20,
    description: "« Ça va j'ai pas mangé. »",
    displayedTags: ['#Hygiène'], hiddenTags: ['#Domestique'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-08', name: '1 Douche par Semaine', emoji: '🚿',
    type: CARD_TYPES.RED_FLAG, value: -25,
    description: "Dit que c'est pour la planète. Personne y croit.",
    displayedTags: ['#Hygiène'], hiddenTags: ['#Anti-Écolo'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-09', name: 'Vomit tes Secrets', emoji: '🤐',
    type: CARD_TYPES.RED_FLAG, value: -20,
    description: "Tu lui dis un truc. Toute la team le sait à 18h.",
    displayedTags: ['#Toxique'], hiddenTags: ['#Sociable'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-10', name: 'Mâche Bouche Ouverte', emoji: '🍔',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Bruit de béton qu'on coule.",
    displayedTags: ['#Public', '#Hygiène'], hiddenTags: ['#Bouffe'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-11', name: 'Radin au Resto', emoji: '💸',
    type: CARD_TYPES.RED_FLAG, value: -20,
    description: "Calcule sa part au centime près.",
    displayedTags: ['#Public', '#Radin'], hiddenTags: ['#Économe'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-12', name: 'Selfie Avant Bouchée', emoji: '🤳',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Story Insta avant que ce soit froid.",
    displayedTags: ['#Tech', '#Public'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-13', name: 'Vaisselle qui Moisit', emoji: '🧹',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "3 jours dans l'évier. « Je vais le faire ce soir. »",
    displayedTags: ['#Bordélique', '#Domestique'], hiddenTags: ['#Hygiène'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-14', name: 'Hurle au Téléphone', emoji: '📞',
    type: CARD_TYPES.RED_FLAG, value: -10,
    description: "Appel privé. Wagon de TGV. Volume max.",
    displayedTags: ['#Public', '#Égoïste'], hiddenTags: ['#Sociable'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-15', name: 'Petits Mensonges', emoji: '🤥',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Ment sur des trucs débiles. Tu le prends jamais.",
    displayedTags: ['#Toxique'], hiddenTags: ['#Cynique'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-16', name: 'Ronfle Comme un Ours', emoji: '😴',
    type: CARD_TYPES.RED_FLAG, value: -10,
    description: "Voisins ont déménagé. Vrai.",
    displayedTags: ['#Domestique'], hiddenTags: ['#Hygiène'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },
  {
    code: 'RF-17', name: 'Vape en Intérieur', emoji: '💨',
    type: CARD_TYPES.RED_FLAG, value: -15,
    description: "Mango ice dans ton salon. Demande pas.",
    displayedTags: ['#Public', '#Hygiène'], hiddenTags: ['#Anti-Écolo'],
    target: CARD_TARGETS.NEXT_PLAYER,
  },

  // ========================================================================
  // 🔴 RED FLAGS — Au Choix (×8)
  // ========================================================================
  {
    code: 'RF-18', name: 'Ex en Photo de Profil', emoji: '📸',
    type: CARD_TYPES.RED_FLAG, value: -25,
    description: "« Mais on était trop beaux sur cette photo. »",
    displayedTags: ['#Ex', '#Toxique'], hiddenTags: ['#Cynique'],
    target: CARD_TARGETS.CHOICE,
  },
  {
    code: 'RF-19', name: "Parle de l'Ex en Boucle", emoji: '💔',
    type: CARD_TYPES.RED_FLAG, value: -25,
    description: "Sait pas tourner une page. Lit le même chapitre.",
    displayedTags: ['#Ex', '#Toxique'], hiddenTags: ['#Sentimental'],
    target: CARD_TARGETS.CHOICE,
  },
  {
    code: 'RF-20', name: 'Jaloux Maladif', emoji: '🚨',
    type: CARD_TYPES.RED_FLAG, value: -30,
    description: "Te demande qui c'est dans ton album photo de 2014.",
    displayedTags: ['#Toxique', '#Possessif'], hiddenTags: ['#Ex'],
    target: CARD_TARGETS.CHOICE,
  },
  {
    code: 'RF-21', name: 'Coma Éthylique Hebdo', emoji: '🍷',
    type: CARD_TYPES.RED_FLAG, value: -25,
    description: "Finit la soirée par terre. Toutes les soirées.",
    displayedTags: ['#Fêtard', '#Toxique'], hiddenTags: ['#Hédoniste'],
    target: CARD_TARGETS.CHOICE,
  },
  {
    code: 'RF-22', name: 'Vit Chez Maman à 35', emoji: '🛏️',
    type: CARD_TYPES.RED_FLAG, value: -25,
    description: "« C'est temporaire. » (depuis 2017)",
    displayedTags: ['#Famille'], hiddenTags: ['#Indépendance'],
    target: CARD_TARGETS.CHOICE,
  },
  {
    code: 'RF-23', name: 'Paquet par Jour', emoji: '🚬',
    type: CARD_TYPES.RED_FLAG, value: -30,
    description: "Sent fort. Tousse à 9h. Refuse d'arrêter.",
    displayedTags: ['#Hygiène', '#Toxique'], hiddenTags: ['#Anti-Écolo'],
    target: CARD_TARGETS.CHOICE,
  },
  {
    code: 'RF-24', name: 'Insulte les Serveurs', emoji: '🤬',
    type: CARD_TYPES.RED_FLAG, value: -30,
    description: "Mauvais avec ceux qui peuvent pas répondre.",
    displayedTags: ['#Public', '#Arrogant'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.CHOICE,
  },
  {
    code: 'RF-25', name: 'Répond après 4 Jours', emoji: '📲',
    type: CARD_TYPES.RED_FLAG, value: -25,
    description: "Sans excuse. « Sah désolé j'avais pas vu. »",
    displayedTags: ['#Communication', '#Toxique'], hiddenTags: ['#Égoïste'],
    target: CARD_TARGETS.CHOICE,
  },

  // ========================================================================
  // 🟣 CONDITIONNELLES (×15)
  // ========================================================================
  {
    code: 'CD-01', name: 'Carnivore Assumé', emoji: '🥩',
    type: CARD_TYPES.CONDITIONAL, value: -30,
    description: "Mange de la viande à tous les repas. Petit-déj inclus.",
    displayedTags: ['#Bouffe', '#Carnivore'], hiddenTags: ['#Anti-Écolo'],
    target: CARD_TARGETS.CHOICE,
    conditional: { requiresAnyTag: ['#Écolo', '#Vegan'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-02', name: 'Veut 4 Enfants Vite', emoji: '👶',
    type: CARD_TYPES.CONDITIONAL, value: -35,
    description: "Et a déjà choisi les prénoms. Tous.",
    displayedTags: ['#Famille', '#Engagement'], hiddenTags: ['#Romantique'],
    target: CARD_TARGETS.CHOICE,
    conditional: { requiresAnyTag: ['#Carrière', '#Indépendance'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-03', name: 'Coloc à 40 ans', emoji: '🏠',
    type: CARD_TYPES.CONDITIONAL, value: -30,
    description: "5 colocs. Tableau de tâches. À 40 piges.",
    displayedTags: ['#Mature'], hiddenTags: ['#Indépendance'],
    target: CARD_TARGETS.CHOICE,
    conditional: { requiresAnyTag: ['#Famille', '#Engagement'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-04', name: "Hérite d'un Empire", emoji: '💰',
    type: CARD_TYPES.CONDITIONAL, value: 30,
    description: "Le grand-père avait des immeubles. Plein.",
    displayedTags: ['#Argent'], hiddenTags: ['#Carrière'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: { requiresAnyTag: ['#Matérialiste', '#Économe'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-05', name: 'Sauve Chats Errants', emoji: '🐱',
    type: CARD_TYPES.CONDITIONAL, value: 30,
    description: "Garage transformé en refuge. 12 chats.",
    displayedTags: ['#Animaux', '#Empathie'], hiddenTags: ['#Chats'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: { requiresAnyTag: ['#Animaux', '#Chats'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-06', name: '4×4 en Centre-Ville', emoji: '🚙',
    type: CARD_TYPES.CONDITIONAL, value: -30,
    description: "Diesel. Pour aller chercher du pain.",
    displayedTags: ['#Anti-Écolo'], hiddenTags: ['#Matérialiste'],
    target: CARD_TARGETS.CHOICE,
    conditional: { requiresAnyTag: ['#Écolo'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-07', name: 'Joue 6h/Jour', emoji: '🎮',
    type: CARD_TYPES.CONDITIONAL, value: -25,
    description: "Discord ouvert pendant les apéros.",
    displayedTags: ['#Geek', '#Tech'], hiddenTags: ['#Sédentaire'],
    target: CARD_TARGETS.CHOICE,
    conditional: { requiresAnyTag: ['#Sportif', '#Sociable'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-08', name: 'Pratiquant Fervent', emoji: '⛪',
    type: CARD_TYPES.CONDITIONAL, value: 25,
    description: "Messe le dimanche. Carême, ramadan, tout.",
    displayedTags: ['#Spiritualité'], hiddenTags: ['#Famille'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: { requiresAnyTag: ['#Spiritualité'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-09', name: 'Bio à Tous les Repas', emoji: '🌿',
    type: CARD_TYPES.CONDITIONAL, value: 25,
    description: "AMAP, vrac, zéro déchet. Tous les repas.",
    displayedTags: ['#Écolo', '#Bouffe'], hiddenTags: ['#Bio'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: { requiresAnyTag: ['#Écolo', '#Vegan'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-10', name: 'PDG de sa Boîte', emoji: '💼',
    type: CARD_TYPES.CONDITIONAL, value: 30,
    description: "30 employés. Levée de fonds bouclée.",
    displayedTags: ['#Carrière'], hiddenTags: ['#Ambitieux'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: { requiresAnyTag: ['#Carrière', '#Ambitieux'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-11', name: 'Démissionne pour Voyager', emoji: '🏝️',
    type: CARD_TYPES.CONDITIONAL, value: 25,
    description: "CDI poubellisé. Sac à dos, ticket simple.",
    displayedTags: ['#Aventurier'], hiddenTags: ['#Liberté'],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: { requiresAnyTag: ['#Aventurier', '#Liberté'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-12', name: 'Tire les Cartes Tous les Matins', emoji: '📿',
    type: CARD_TYPES.CONDITIONAL, value: 25,
    description: "Aucune décision sans le tarot. Aucune.",
    displayedTags: ['#Spiritualité'], hiddenTags: [],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: {
      requiresAnyTag: ['#Spiritualité'],
      fallbackBehavior: 'apply_negative',
      valueIfMatch: 25,
      valueIfNoMatch: -25,
    },
  },
  {
    code: 'CD-13', name: 'Bières Tous les Soirs', emoji: '🍻',
    type: CARD_TYPES.CONDITIONAL, value: -25,
    description: "Pack du frigo en autarcie depuis 3 ans.",
    displayedTags: ['#Fêtard'], hiddenTags: ['#Hédoniste'],
    target: CARD_TARGETS.CHOICE,
    conditional: { requiresAnyTag: ['#Sportif', '#Spiritualité'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-14', name: '5000€/Mois en Cosmétiques', emoji: '💄',
    type: CARD_TYPES.CONDITIONAL, value: -30,
    description: "Salle de bain plus chère que la chambre.",
    displayedTags: ['#BeautyHolic', '#Dépensier'], hiddenTags: ['#Matérialiste'],
    target: CARD_TARGETS.CHOICE,
    conditional: { requiresAnyTag: ['#Économe', '#Écolo'], fallbackBehavior: 'discard' },
  },
  {
    code: 'CD-15', name: "Dort jusqu'à 14h le Week-End", emoji: '🛌',
    type: CARD_TYPES.CONDITIONAL, value: 20,
    description: "Volets fermés. Téléphone éteint. Personne.",
    displayedTags: ['#Casanier'], hiddenTags: [],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    conditional: {
      requiresAnyTag: ['#Casanier'],
      fallbackBehavior: 'apply_negative',
      valueIfMatch: 20,
      valueIfNoMatch: -20,
    },
  },

  // ========================================================================
  // 🛡️ BOUCLIERS (×5)
  // ========================================================================
  {
    code: 'BG-01', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« Mais non t'as rien vu, t'inventes. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },
  {
    code: 'BG-02', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« C'est pas du tout ce que j'ai dit. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },
  {
    code: 'BG-03', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« T'es sûr ? Moi j'ai pas eu ce souvenir. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },
  {
    code: 'BG-04', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« T'es trop sensible. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },
  {
    code: 'BG-05', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« Tu vois le mal partout. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },
  {
    code: 'BG-06', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« On en a déjà parlé, t'as pas écouté. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },
  {
    code: 'BG-07', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« T'as mal interprété, c'est tout. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },
  {
    code: 'BG-08', name: 'Gaslighting', emoji: '🛡',
    type: CARD_TYPES.SHIELD, value: 0,
    description: "« T'exagères encore, comme d'habitude. »",
    displayedTags: ['#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
  },

  // ========================================================================
  // 🔵 CARTES ACTION (×15)
  // ========================================================================
  {
    code: 'AC-01', name: 'Glow Up', emoji: '✨',
    type: CARD_TYPES.ACTION, value: 0,
    description: "3 jours offline. Masque argile. Renaissance.",
    displayedTags: ['#Soin'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.PURGE_RED_FLAGS,
  },
  {
    code: 'AC-02', name: 'Retraite Wellness', emoji: '💆',
    type: CARD_TYPES.ACTION, value: 5,
    description: "Spa-yoga-méditation. Pic de séduction.",
    displayedTags: ['#Soin', '#Spiritualité'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.PURGE_AND_BOOST,
  },
  {
    code: 'AC-03', name: 'Spa Week-End', emoji: '🧖',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Hammam puis massage. Personne ne t'atteint.",
    displayedTags: ['#Soin'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.PURGE_AND_IMMUNITY,
  },
  {
    code: 'AC-04', name: 'Gossip Classique', emoji: '🗣️',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Tu sais des trucs. Tu les utilises.",
    displayedTags: ['#Vol'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.STEAL_GREEN_FLAG,
  },
  {
    code: 'AC-05', name: 'Potin de Groupe', emoji: '📢',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Vol + sa story devient virale.",
    displayedTags: ['#Vol'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.STEAL_AND_FORCE_DRAW,
  },
  {
    code: 'AC-06', name: 'Rumeur Virale', emoji: '💬',
    type: CARD_TYPES.ACTION, value: -10,
    description: "Vol + tu lui colles une mauvaise réputation.",
    displayedTags: ['#Vol'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.STEAL_AND_PLACE_RED,
  },
  {
    code: 'AC-07', name: "L'Ex Toxique", emoji: '💔',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Apparait au pire moment. Gèle l'autre.",
    displayedTags: ['#Stun', '#Ex'], hiddenTags: [],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.STUN_NEXT_TURN,
  },
  {
    code: 'AC-08', name: 'Appel Drunk à 3h', emoji: '📞',
    type: CARD_TYPES.ACTION, value: -10,
    description: "Stun + un peu de séduction qui s'envole.",
    displayedTags: ['#Stun'], hiddenTags: ['#Fêtard'],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.STUN_AND_DAMAGE,
  },
  {
    code: 'AC-09', name: 'Alerte Groupe WhatsApp', emoji: '🚨',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Stun deux personnes différentes. Boom.",
    displayedTags: ['#Stun', '#Sociable'], hiddenTags: [],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.STUN_TWO_TARGETS,
    rare: true,
  },
  {
    code: 'AC-10', name: 'Stalker', emoji: '👁️',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Tu connais déjà les 3 prochaines cartes.",
    displayedTags: ['#Vision'], hiddenTags: ['#Toxique'],
    target: CARD_TARGETS.DECK,
    actionEffect: ACTION_EFFECTS.PEEK_DECK,
  },
  {
    code: 'AC-11', name: 'Enquête Insta', emoji: '🔍',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Tu fouilles. Tu sais tout.",
    displayedTags: ['#Vision'], hiddenTags: [],
    target: CARD_TARGETS.HAND,
    actionEffect: ACTION_EFFECTS.PEEK_HAND,
  },
  {
    code: 'AC-12', name: 'Swipe Left', emoji: '🔄',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Cette pioche te dit rien. Tu passes.",
    displayedTags: ['#Esquive'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.SKIP_DRAW,
  },
  {
    code: 'AC-13', name: 'Bloquer', emoji: '🚫',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Skip + un tour d'immunité aux Red Flags Suivant.",
    displayedTags: ['#Esquive', '#Défense'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.BLOCK,
  },
  {
    code: 'AC-14', name: 'Catfish', emoji: '🎲',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Tu mélanges tout. Le destin redistribue.",
    displayedTags: ['#Chaos'], hiddenTags: [],
    target: CARD_TARGETS.DECK,
    actionEffect: ACTION_EFFECTS.SHUFFLE_DECK,
  },
  {
    code: 'AC-15', name: 'DM Glissé', emoji: '💌',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Échange complet de mains. Russian roulette.",
    displayedTags: ['#Chaos', '#Toxique'], hiddenTags: [],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.SWAP_HANDS,
    rare: true,
  },

  // ========================================================================
  // 📲 CARTES PIOCHE (la chaîne, ×10)
  // ========================================================================
  {
    code: 'PC-01a', name: 'Spam de Likes', emoji: '💌',
    type: CARD_TYPES.DRAW, value: 0,
    description: "57 likes en 4 minutes. Sur des photos de 2019.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 2,
  },
  {
    code: 'PC-01b', name: 'Spam de Likes', emoji: '💌',
    type: CARD_TYPES.DRAW, value: 0,
    description: "57 likes en 4 minutes. Sur des photos de 2019.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 2,
  },
  {
    code: 'PC-01c', name: 'Spam de Likes', emoji: '💌',
    type: CARD_TYPES.DRAW, value: 0,
    description: "57 likes en 4 minutes. Sur des photos de 2019.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 2,
  },
  {
    code: 'PC-02a', name: 'Avalanche de Matchs', emoji: '🔔',
    type: CARD_TYPES.DRAW, value: 0,
    description: "Notif sur notif. Le tel chauffe.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 3,
  },
  {
    code: 'PC-02b', name: 'Avalanche de Matchs', emoji: '🔔',
    type: CARD_TYPES.DRAW, value: 0,
    description: "Notif sur notif. Le tel chauffe.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 3,
  },
  {
    code: 'PC-02c', name: 'Avalanche de Matchs', emoji: '🔔',
    type: CARD_TYPES.DRAW, value: 0,
    description: "Notif sur notif. Le tel chauffe.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: ['#Réseaux'],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 3,
  },
  {
    code: 'PC-03a', name: 'Tinder Burnout', emoji: '🔥',
    type: CARD_TYPES.DRAW, value: 0,
    description: "Trop de matchs. Plus envie. Mais cinq cartes.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: [],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 5,
  },
  {
    code: 'PC-03b', name: 'Tinder Burnout', emoji: '🔥',
    type: CARD_TYPES.DRAW, value: 0,
    description: "Trop de matchs. Plus envie. Mais cinq cartes.",
    displayedTags: ['#Pioche', '#Chaîne'], hiddenTags: [],
    target: CARD_TARGETS.NEXT_PLAYER,
    chainValue: 5,
  },
  {
    code: 'PC-04', name: 'Storm de Notifs', emoji: '🌪️',
    type: CARD_TYPES.DRAW, value: 0,
    description: "Tout le monde pioche. Personne n'échappe.",
    displayedTags: ['#Pioche', '#Chaos'], hiddenTags: [],
    target: CARD_TARGETS.ALL,
    chainValue: 1,
    rare: true,
  },
  {
    code: 'PC-05', name: 'Super Like Inverse', emoji: '⚡',
    type: CARD_TYPES.DRAW, value: 0,
    description: "L'autre pioche, mais toi aussi. Ça pique.",
    displayedTags: ['#Pioche'], hiddenTags: [],
    target: CARD_TARGETS.CHOICE,
    chainValue: 1,
    selfPenalty: 1,
  },

  // ========================================================================
  // 💕 CARTES CRUSH (×20 — 5 personnages × 4 copies pour les combos)
  // ========================================================================
  // Combo x2 (2 identiques) → vol 1 carte au hasard
  // Combo x3 (3 identiques) → demande une carte précise
  ...Array.from({ length: 4 }, (_, i) => ({
    code: `CR-LUNA-${i+1}`, name: 'Luna', emoji: '🌙',
    type: CARD_TYPES.CRUSH, value: 0,
    description: "L'inaccessible. Mystérieuse, distante, fascinante.",
    displayedTags: ['#Crush'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    crushIdentity: 'LUNA',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    code: `CR-AXEL-${i+1}`, name: 'Axel', emoji: '🔥',
    type: CARD_TYPES.CRUSH, value: 0,
    description: "Le bad boy au cœur tendre. Roule en moto, écrit des poèmes.",
    displayedTags: ['#Crush'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    crushIdentity: 'AXEL',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    code: `CR-EMMA-${i+1}`, name: 'Emma', emoji: '🌸',
    type: CARD_TYPES.CRUSH, value: 0,
    description: "La meilleure amie. Tu y as toujours pensé. Discret.",
    displayedTags: ['#Crush'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    crushIdentity: 'EMMA',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    code: `CR-VICTOR-${i+1}`, name: 'Victor', emoji: '👔',
    type: CARD_TYPES.CRUSH, value: 0,
    description: "Le boss du bureau. Charisme, costume, tu craques.",
    displayedTags: ['#Crush'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    crushIdentity: 'VICTOR',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    code: `CR-MILA-${i+1}`, name: 'Mila', emoji: '☀️',
    type: CARD_TYPES.CRUSH, value: 0,
    description: "L'énergie pure. Te fait rire à 7h du matin.",
    displayedTags: ['#Crush'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    crushIdentity: 'MILA',
  })),

  // ========================================================================
  // 🃏 CRUSH JOKER (×3) — complète n'importe quel combo
  // ========================================================================
  ...Array.from({ length: 3 }, (_, i) => ({
    code: `CR-JOKER-${i+1}`, name: 'Joker du Cœur', emoji: '🃏',
    type: CARD_TYPES.CRUSH, value: 0,
    description: "Match avec n'importe quel Crush. Le wildcard de l'amour.",
    displayedTags: ['#Crush', '#Joker'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    crushIdentity: 'JOKER',
    isJoker: true,
  })),

  // ========================================================================
  // 🚫 NOPE (×4) — annule l'action précédente
  // ========================================================================
  ...Array.from({ length: 4 }, (_, i) => ({
    code: `NOPE-${i+1}`, name: 'Nope !', emoji: '🚫',
    type: CARD_TYPES.NOPE, value: 0,
    description: "Annule instantanément la dernière action jouée. Chaîne possible.",
    displayedTags: ['#Réaction'], hiddenTags: [],
    target: CARD_TARGETS.NONE,
    actionEffect: ACTION_EFFECTS.NOPE_LAST,
  })),

  // ========================================================================
  // ⏭ SKIP (×3) + SUPER SKIP (×2)
  // ========================================================================
  ...Array.from({ length: 3 }, (_, i) => ({
    code: `SKIP-${i+1}`, name: 'Passer', emoji: '⏭',
    type: CARD_TYPES.SKIP, value: 0,
    description: "Tu passes ton tour sans piocher. Esquive propre.",
    displayedTags: ['#Esquive'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.SKIP_DRAW,
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    code: `SUPERSKIP-${i+1}`, name: 'Super Passer', emoji: '⚡',
    type: CARD_TYPES.SKIP, value: 0,
    description: "Annule une chaîne de pioche entière et passe au joueur suivant.",
    displayedTags: ['#Esquive', '#Anti-Chaîne'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.SUPER_SKIP,
  })),

  // ========================================================================
  // 💚 SUBTILITÉ (×2) — transforme un Red Flag posé en Green Flag
  // ========================================================================
  ...Array.from({ length: 2 }, (_, i) => ({
    code: `AC-SUBTIL-${i+1}`, name: 'Subtilité', emoji: '💚',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Transforme un Red Flag posé sur toi en Green Flag. Reframe.",
    displayedTags: ['#Soin', '#Reframe'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.TRANSFORM_FLAG,
  })),

  // ========================================================================
  // 🧹 TABLE RASE (×2) — vide tous les flags d'une cible
  // ========================================================================
  ...Array.from({ length: 2 }, (_, i) => ({
    code: `AC-RASE-${i+1}`, name: 'Table Rase', emoji: '🧹',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Cible un joueur (toi inclus). Tous ses flags posés disparaissent. Reset complet.",
    displayedTags: ['#Reset', '#Chaos'], hiddenTags: [],
    target: CARD_TARGETS.SELF_OR_CHOICE,
    actionEffect: ACTION_EFFECTS.TABLE_RASE,
  })),

  // ========================================================================
  // 🃏 Cartes "Exploding Kittens style"
  // ========================================================================

  // Mélanger : choisir 1ère et dernière carte du deck, le reste est aléatoire
  ...Array.from({ length: 2 }, (_, i) => ({
    code: `AC-MELANGE-${i+1}`, name: 'Mélanger', emoji: '🔀',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Tu choisis la 1ère et la dernière carte du deck. Le reste est mélangé.",
    displayedTags: ['#Mélange', '#Triche'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.SHUFFLE_CHOICE,
  })),

  // Faveur : demande une carte à un adversaire (qu'il choisit)
  ...Array.from({ length: 3 }, (_, i) => ({
    code: `AC-FAVEUR-${i+1}`, name: 'Faveur', emoji: '🙏',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Demande une carte à un adversaire. C'est lui qui choisit laquelle te donner.",
    displayedTags: ['#Vol', '#Social'], hiddenTags: [],
    target: CARD_TARGETS.CHOICE,
    actionEffect: ACTION_EFFECTS.FAVOR,
  })),

  // Divination : montre les 3 prochaines cartes à tout le monde
  ...Array.from({ length: 3 }, (_, i) => ({
    code: `AC-DIVIN-${i+1}`, name: 'Divination', emoji: '🔮',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Tous les joueurs voient les 3 prochaines cartes du deck.",
    displayedTags: ['#Vision', '#Public'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.SEE_THE_FUTURE,
  })),

  // Changer l'avenir : tu vois et réordonnes les 3 prochaines
  ...Array.from({ length: 2 }, (_, i) => ({
    code: `AC-FUTUR-${i+1}`, name: "Changer l'Avenir", emoji: '✨',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Tu vois les 3 prochaines cartes et tu les remets dans l'ordre que tu veux.",
    displayedTags: ['#Vision', '#Privé'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.ALTER_THE_FUTURE,
  })),

  // Retournement : pioche depuis le fond du deck
  ...Array.from({ length: 2 }, (_, i) => ({
    code: `AC-RETOURN-${i+1}`, name: 'Retournement', emoji: '🔄',
    type: CARD_TYPES.ACTION, value: 0,
    description: "Pioche la carte du fond du deck au lieu de celle du dessus.",
    displayedTags: ['#Esquive'], hiddenTags: [],
    target: CARD_TARGETS.SELF,
    actionEffect: ACTION_EFFECTS.DRAW_FROM_BOTTOM,
  })),
];

/**
 * Map pour accès rapide par code de carte.
 */
export const CARDS_BY_CODE = Object.fromEntries(
  CARDS_CATALOG.map(card => [card.code, card])
);

/**
 * Helper : retourne une carte par son code.
 */
export function getCard(code) {
  return CARDS_BY_CODE[code] || null;
}

/**
 * Helper : retourne toutes les cartes d'un type donné.
 */
export function getCardsByType(type) {
  return CARDS_CATALOG.filter(c => c.type === type);
}
