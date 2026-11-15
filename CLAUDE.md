# logiciel_coordo — instructions projet

Outil de coordination (« topage ») pour événements sportifs, surtout l'athlétisme :
1. **Conducteur** (préparation) : construit un conducteur propre à partir de l'horaire,
   des routines, des contraintes TV / marketing / lumière / écran géant / show.
2. **Live** (exploitation, phase 2) : le topeur (seul éditeur) valide les tops en direct ;
   chaque poste (DJ, speaker, écran, lumière, TV…) suit sur son appareil le compte à rebours
   à la seconde et ce qui vient après.

## Utilisateur
- Alexandre, topeur événementiel et speaker athlétisme. **Aucune formation en code** :
  expliquer simplement, livrer des fichiers complets, pas d'extraits à recoller.
- Teste entre les sessions et revient avec des retours terrain.
- Projet **indépendant** du projet CIS speaker (ne pas mélanger).

## Règles métier (validées le 14/11/2026)
- Précision des horaires et durées : **paliers de 15 secondes**.
- Un seul éditeur en live : le topeur. Les autres postes sont en lecture seule.
- Certaines contraintes sont **fixes** (horaires de diffusion TV) ; les autres sont mobiles.
- En cas de retard : **rattraper progressivement**, en raccourcissant / supprimant
  d'abord les séquences **secondaires**, sans jamais déplacer une contrainte fixe.
- Connexion internet (4G/5G/wifi) supposée stable sur site.
- Modèle de référence : conducteur Google Sheets du Meeting de l'Eure Crédit Mutuel 2026
  (colonnes N° / Heure / Durée / Action / DJ / Speaker / Écran géant / Comp 1-2-3,
  routines présentation → start-list → line-up → épreuve → résultat, calcul à rebours
  depuis l'heure de l'épreuve).

## Technique
- Site statique (HTML/CSS/JS sans outil de build), hébergeable sur GitHub Pages.
- Données d'un événement = un objet JSON (sauvegarde locale + fichier .json).
- Phase 2 : synchronisation temps réel via un service gratuit (Firebase Realtime Database
  envisagé, avec correction d'horloge serveur pour des comptes à rebours identiques).
- Tout le texte de l'interface en français.

## Fichiers
- `index.html` + `js/app.js` : accueil « Mes événements » + éditeur de conducteur.
  Bibliothèque dans localStorage : `coordo.lib` (index) + `coordo.ev.<id>` (un événement).
  L'événement ouvert est dans l'adresse (`#e=<id>`) → plusieurs onglets possibles.
  Chaque événement a son code live (`liveCode`). « Passer en LIVE » écrit le plan dans
  `coordo.liveplan.<id>` et ouvre `live.html?regie=1&e=<id>`.
- `live.html` + `js/live.js` : régie (`?regie=1`), postes (`?code=…&poste=…`), accueil.
  Projection du retard : une ligne démarre au plus tôt à son heure prévue et après la fin de
  la précédente (le retard se résorbe dans les trous) ; une ligne FIXE ne bouge jamais
  (« menacée » si retard).
- Journal / RETEX : `LIVE.journal` (tops avec écart, annulations, suppressions, durées, messages,
  notes) + `LIVE.notes` par ligne. Page `live.html?journal=1&e=<id>&code=…` (synthèse, chronologie,
  détail ligne par ligne, export Excel, impression). Archives dans `coordo.retex.<id>`
  (incluses dans l'export .json de l'événement).
- `js/firebase-config.js` : config Firebase (null = mode local). Mode d'emploi : `docs/firebase.md`.

Voir `docs/cahier-des-charges.md`.
