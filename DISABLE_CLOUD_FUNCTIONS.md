# Désactiver les Cloud Functions

Le jeu n'utilise plus les Cloud Functions depuis la refonte P2P (peer-to-peer).
Tu peux les supprimer pour ne pas qu'elles tournent inutilement.

## Méthode 1 : Suppression complète (recommandé)

Dans le terminal, dans ton dossier `redflag` :

```bash
firebase functions:delete onGameAction --region europe-west1
firebase functions:delete onTurnTimeout --region europe-west1
firebase functions:delete onPresenceWrite --region europe-west1
firebase functions:delete onForceSkipAfterDisconnect --region europe-west1
firebase functions:delete onKickTimerWrite --region europe-west1
```

Confirme avec **Yes** à chaque fois.

## Méthode 2 : Repasser au plan Spark (gratuit)

Une fois les fonctions supprimées :

1. Va sur https://console.firebase.google.com
2. Sélectionne ton projet `redflag-e31a3`
3. En bas à gauche, clique sur le plan actuel (Blaze)
4. Choisis **"Spark - gratuit"**

⚠️ **Note** : sans plan Blaze, certains services Firebase deviennent indisponibles (Cloud Functions, Cloud Run, etc.) mais Realtime Database, Auth et Hosting restent gratuits et fonctionnels.

## Vérification

Pour vérifier qu'aucune fonction n'est plus active :

```bash
firebase functions:list
```

Tu ne devrais plus voir de fonctions listées.
