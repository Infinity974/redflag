/**
 * RedFlag — Configuration Firebase
 *
 * ⚠️ Ce fichier contient la config publique du projet Firebase.
 * Ce n'est PAS un secret — l'apiKey Firebase est publique par design.
 * La sécurité repose sur les règles RTDB + l'authentification.
 *
 * À ne jamais mettre ici :
 * - Clés privées (service account, Cloud Functions auth)
 * - Tokens d'API tiers (Stripe, Sendgrid, etc.)
 *
 * Pour modifier : remplace les valeurs ci-dessous par celles de ton projet
 * (Project Settings → Your apps → Web → Config).
 */

export const firebaseConfig = {
  apiKey: "AIzaSyBED9bYOt2iGqXX25uKuEncV9cJJQve5sQ",
  authDomain: "redflag-e31a3.firebaseapp.com",
  databaseURL: "https://redflag-e31a3-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "redflag-e31a3",
  storageBucket: "redflag-e31a3.firebasestorage.app",
  messagingSenderId: "747402257648",
  appId: "1:747402257648:web:e86b5579a1f1c505ad8e35",
  measurementId: "G-WJ61N8TBMT"
};

/**
 * Configuration applicative liée à Firebase
 */
export const firebaseAppConfig = {
  // Région des Cloud Functions (doit matcher la région choisie au déploiement)
  functionsRegion: 'europe-west1',

  // Préfixe des paths RTDB
  rooms: {
    basePath: 'rooms',
    publicStatePath: 'publicState',
    privateHandsPath: 'privateHands',
    actionsPath: 'actions',
  },

  // Codes de salon : 4 caractères, sans I/O/L/0/1 pour éviter confusion
  roomCode: {
    length: 4,
    chars: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  },

  // Reconnexion : combien de temps un joueur peut rester déconnecté avant kick
  reconnectGraceMs: 60_000, // 1 minute
  presenceCheckIntervalMs: 5_000, // 5 sec
};
