# Activer la synchronisation en ligne (Firebase) — 10 minutes, gratuit

Sans Firebase, le live marche en **mode local** : la régie et les postes ne se voient
qu'entre onglets du même navigateur, sur le même ordinateur (idéal pour tester).
Avec Firebase, le DJ, le speaker, l'écran… suivent sur **leur propre appareil**.

## 1. Créer le projet
1. Aller sur https://console.firebase.google.com avec ton compte Google.
2. **Créer un projet** → nom : `coordo` → désactiver Google Analytics (inutile) → Créer.

## 2. Créer la base temps réel
1. Menu de gauche : **Créer** (ou *Build*) → **Realtime Database** → **Créer une base de données**.
2. Emplacement : **Belgique (europe-west1)**.
3. Choisir **Démarrer en mode verrouillé** → Activer.
4. Onglet **Règles** : remplacer tout le texte par ceci, puis **Publier** :

```json
{
  "rules": {
    "events": {
      "$code": { ".read": true, ".write": true }
    }
  }
}
```

## 3. Récupérer la configuration
1. Roue dentée (en haut à gauche) → **Paramètres du projet**.
2. En bas, « Vos applications » → icône **Web `</>`** → surnom : `coordo-web`
   (ne pas cocher Firebase Hosting) → Enregistrer.
3. Firebase affiche un bloc `const firebaseConfig = { ... }`. **Copie-le en entier.**
   Il doit contenir une ligne `databaseURL`. Si elle manque, ajoute-la avec l'adresse
   affichée en haut de la page Realtime Database
   (ex. `https://coordo-xxxxx-default-rtdb.europe-west1.firebasedatabase.app`).

## 4. Brancher Coordo
- **Pour tester tout de suite** : régie → carte « Plan & synchronisation » →
  « Réglages Firebase » → coller le bloc → Enregistrer. Les liens et QR codes des postes
  transportent alors la configuration.
- **Définitivement** : envoyer le bloc à Claude, qui l'inscrit dans `js/firebase-config.js`
  (ces informations ne sont pas secrètes : elles identifient la base, elles ne donnent
  pas de droits d'administration).

## Bon à savoir
- Offre gratuite (Spark) : largement suffisante (environ 100 appareils connectés en même temps).
- Sécurité V1 : toute personne qui connaît le **code à 6 caractères** de l'événement peut
  lire le live (et, techniquement, écrire). Ne diffuse les liens qu'aux postes concernés.
  Une V2 pourra verrouiller l'écriture à la seule régie.
