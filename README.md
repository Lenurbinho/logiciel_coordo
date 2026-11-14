# Coordo — logiciel de coordination événementielle

Outil de topage pour événements sportifs (athlétisme en priorité).

## Ouvrir l'outil
- En ligne : https://lenurbinho.github.io/logiciel_coordo/
- Ou en local : double-cliquer sur `index.html`.

## Module Conducteur (V1)
1. **Événement** : nom, date, lieu, postes (colonnes DJ / Speaker / Écran / Lumière / TV / Marketing), zones de compétition.
2. **Routines** : enchaînements types (présentation → start-list → line-up → épreuve → résultat), calculés à rebours depuis l'heure de l'épreuve.
3. **Programme** : courses, concours et blocs (cérémonie, partenaires, tunnel pub, animations, alertes). Contraintes fixes (TV) et priorités (essentiel / secondaire / sacrifiable).
4. **Conducteur** : rendu final, vue par poste, alertes d'enchaînements serrés, impression PDF, export Excel.
5. **Fichiers** : enregistrer / ouvrir un événement (.json), importer un horaire par copier-coller.

Le module **Live** (suivi en direct multi-postes) arrive en phase 2 — voir `docs/cahier-des-charges.md`.
