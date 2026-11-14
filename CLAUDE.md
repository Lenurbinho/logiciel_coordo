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

Voir `docs/cahier-des-charges.md`.
