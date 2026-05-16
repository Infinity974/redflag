# 🚩 RedFlag

> Le party game où séduire, c'est survivre.

Mélange UNO + Exploding Kittens + Cards Against Humanity. 4-8 joueurs, parties de 15-25 minutes, **mode solo vs bots disponible**. Multijoueur en ligne via Firebase (architecture prête).

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
