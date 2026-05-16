# 🚩 RedFlag

> Le party game où séduire, c'est survivre.

Mélange UNO + Exploding Kittens + Cards Against Humanity. 4-8 joueurs, parties de 15-25 minutes, **mode solo vs bots disponible**. Multijoueur en ligne via Firebase (architecture prête).

---

## 🚀 Lancement rapide

```bash
cd redflag
python3 -m http.server 8000
# Ouvre http://localhost:8000
```

---

## 🏗 Architecture

```
redflag/
├── index.html
├── functions/                        # ☁️ Cloud Functions (étapes 5-6)
│   ├── package.json
│   └── index.js                      # onGameAction, onTurnTimeout, présence, kick
├── css/
└── js/
    ├── engine/
    │   ├── game-state.js             # State + transitions + déco/reconnexion
    │   └── turn-manager.js           # Tours + skip déconnectés
    ├── controllers/
    │   ├── game-controller.js        # Orchestrateur solo
    │   └── multiplayer-controller.js # Orchestrateur multi (étapes 7-8)
    └── services/
        ├── firebase-service.js
        ├── rooms-service.js
        └── presence-service.js       # Présence + sync RTDB (étape 9)
```

---

## ✅ Plan multijoueur — État d'avancement

| Étape | Description | Statut |
|-------|-------------|--------|
| 1 | Firebase config + auth anonyme | ✅ |
| 2 | Rooms service (create/join/leave/kick) | ✅ |
| 3 | Lobby temps réel | ✅ |
| 4 | Démarrage de partie depuis lobby | ✅ |
| **5** | **Cloud Functions : validation actions serveur** | **✅** |
| **6** | **Cloud Functions : présence / kick timeout** | **✅** |
| **7** | **Multiplayer controller (HOST architecture)** | **✅** |
| **8** | **Sync publicState + privateHands RTDB** | **✅** |
| **9** | **Reconnexion + edge cases** | **✅** |

---

## 🎮 Règles vérifiées

### ✅ Fenêtre Nope — personne ne peut rien faire pendant ce temps

- `scheduleNextBotIfNeeded()` vérifie `state.nopeWindow` → **les bots attendent**.
- `isProcessing = true` côté humain → **le joueur est bloqué**.
- Timer **5 secondes** fixe. Chaque Nope joué **relance le timer à 5s**.
- La fenêtre ne passe plus en mode "illimité" (`isPaused` supprimé).

### ✅ 1 Green + 1 Red max par tour

- Validé dans `playCard()` (game-state.js) et dans les Cloud Functions.
- **Ne comptent pas dans cette limite** : Crush combo, Actions, Skip, Nope.

### ✅ Carte consommée / défaussée même si Nopée

- La carte attaquante est défaussée dès que la fenêtre Nope se ferme, qu'elle soit annulée ou non.
- Chaque carte Nope jouée dans la chaîne est défaussée immédiatement.

### ✅ Déconnexion / Reconnexion

**Joueur actif déco :**
- `turn.disconnectedDuringTurnUid` sauvegarde son UID.
- Le tour avance au joueur suivant.
- **Revient avant 30s** → tour restauré complet (compteurs remis à zéro).
- **Revient après 30s** → déjà kické (ghosté) par Cloud Function.

**Joueur non-actif déco :**
- Marqué `isConnected: false`.
- Skipé automatiquement dans `advanceToNextTurn`.
- Revient → reprend sa place normale.

**Continue tant que le joueur actif est connecté :**
- Anti-softlock : si tous sont déco, pas de boucle infinie.
- Kick timer : 30s via `onKickTimerWrite` → ghost.

---

## 🎨 Fonctionnalités

### Mode solo (vs bots)

- **3 niveaux** : Facile / Normal / Difficile
- 4 à 8 joueurs, 8 couleurs

### Cartes (~165)

| Type | Limite/tour |
|---|---|
| 🟢 Green Flag | **Max 1** |
| 🔴 Red Flag | **Max 1 + finit le tour** |
| 💕 Crush | — (combo ×2 ou ×3) |
| 🚫 Nope | — (fenêtre 5s) |
| ⚡ Action / ⏭ Skip | — |
| 🃏 Conditional | — |
| 👻 Ghosté | dans deck |

---

## ☁️ Déploiement Cloud Functions

```bash
cd redflag/functions && npm install
firebase deploy --only functions

# Test local
firebase emulators:start --only functions,database
```

Fonctions déployées :
- `onGameAction` — validation serveur
- `onTurnTimeout` — force-skip à 60s
- `onPresenceWrite` — déco/reconnexion
- `onForceSkipAfterDisconnect` — skip 5s après déco
- `onKickTimerWrite` — ghost à 30s

---

## ✅ Tests validés

- ✅ Limite 1 Green + 1 Red / tour
- ✅ Nope bloque tout le monde (humains + bots) pendant la fenêtre
- ✅ Timer Nope 5s fixe, relancé à chaque Nope
- ✅ Carte attaquante défaussée même si nopée
- ✅ Crush/Action/Skip/Nope exclus de la limite Green/Red
- ✅ Reconnexion joueur actif → tour complet restauré
- ✅ Déco non-actif → skipé dans la rotation
- ✅ 30s sans retour → kick (ghost)
- ✅ Anti-softlock si tous déconnectés
- ✅ Simulation 5 parties → aucun crash

## 🐛 Bugs connus

- Animation Nope/Crush légèrement désynchronisée si la cible est choisie tard
- Edge case stun total (tous stunnés simultanément) → très rare, pas prioritaire
- `multiplayer-controller.js` prêt mais pas encore branché à `game-entry.js`

---

## 📝 Licence

Privé.
