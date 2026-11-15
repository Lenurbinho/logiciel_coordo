# Coordo — logiciel de coordination événementielle

Outil de topage pour événements sportifs (athlétisme en priorité).

## Ouvrir l'outil
- En ligne : https://lenurbinho.github.io/logiciel_coordo/
- Ou en local : double-cliquer sur `index.html`.

## Mes événements
L'accueil liste tous les événements gardés dans le navigateur : ouvrir, dupliquer, exporter en .json, supprimer, importer. Un événement par onglet si besoin.

## Module Conducteur (V1)
1. **Événement** : nom, date, lieu, postes (colonnes DJ / Speaker / Écran / Lumière / TV / Marketing), zones de compétition.
2. **Routines** : enchaînements types (présentation → start-list → line-up → épreuve → résultat), calculés à rebours depuis l'heure de l'épreuve.
3. **Programme** : courses, concours et blocs (cérémonie, partenaires, tunnel pub, animations, alertes). Contraintes fixes (TV) et priorités (essentiel / secondaire / sacrifiable).
4. **Conducteur** : rendu final, vue par poste, alertes d'enchaînements serrés, impression PDF, export Excel.
5. **Fichiers** : enregistrer / ouvrir un événement (.json), importer un horaire par copier-coller.

## Module Live
- Depuis l'éditeur : bouton **▶ LIVE** → ouvre la **régie** (`live.html?regie=1`).
- Régie : bouton **TOP** (ou barre d'espace) à chaque début d'action, annulation, retard en direct,
  alerte sur les contraintes fixes avec propositions de rattrapage, réglage des durées, suppression
  de lignes, messages aux postes, liens + QR codes par poste.
- Postes (lecture seule) : `live.html?code=XXXXXX&poste=dj` — heure, action en cours,
  compte à rebours jusqu'à **sa** prochaine action, consignes suivantes, messages de la régie.
- Synchronisation entre appareils : Firebase — voir `docs/firebase.md`. Sans configuration :
  mode local (onglets d'un même navigateur).
