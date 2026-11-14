# Cahier des charges — logiciel_coordo

## 1. Module Conducteur (V1)

### Données d'entrée
- **Événement** : nom, date, lieu.
- **Postes** (colonnes « qui fait quoi ») : DJ, Speaker, Écran géant, Lumière, TV,
  Marketing — ajoutables / renommables / masquables.
- **Zones de compétition** : Piste, Concours 1, Concours 2… (épreuves simultanées).
- **Routines** : modèles réutilisables (ex. « Course internationale – finale ») =
  étapes *avant* l'épreuve (présentation, start-list, line-up…) et *après*
  (annonce résultat, ITW…), chacune avec une durée et une consigne par poste.
- **Programme** : liste des éléments
  - *Épreuve course* : heure de départ, naming partenaire, routine, durée estimée,
    wave light, zone.
  - *Épreuve concours* : heure de début, heure de fin estimée (affichée en continu
    dans sa zone), routine.
  - *Bloc* : cérémonie, animation, tunnel marketing, annonces partenaires, protocole,
    alerte… Heure fixe **ou** enchaîné après l'élément précédent.
  - Pour chaque élément : **contrainte fixe** (TV) oui/non, **priorité**
    (essentiel / secondaire / sacrifiable), notes.

### Calculs
- Étapes « avant » calculées **à rebours** depuis l'heure de l'épreuve.
- Étapes « après » enchaînées à la fin estimée de l'épreuve.
- Tout arrondi au palier de 15".
- Détection automatique des **chevauchements** (enchaînements serrés) → alerte.
- Concours affichés en continu dans leur colonne de zone (« en cours »).

### Sorties
- Conducteur complet à l'écran, couleurs par type de ligne.
- **Vue par poste** (DJ seul, Speaker seul…).
- Impression / PDF (A4 paysage, en-têtes répétés).
- Export Excel.
- Sauvegarde / ouverture d'un fichier `.json` par événement.
- Import de l'horaire par copier-coller depuis Excel.

## 2. Module Live (phase 2)
- Le topeur lance chaque top (GO). Heure réelle vs heure prévue → **retard en cours**.
- Postes en lecture seule sur leur appareil (lien par poste) : top en cours,
  compte à rebours à la seconde, 2–3 tops suivants, consignes du poste.
- **Rattrapage progressif** : le logiciel propose de raccourcir ou supprimer les
  séquences secondaires / sacrifiables pour revenir à l'heure avant la prochaine
  contrainte fixe ; les contraintes fixes ne bougent jamais.
- Horloge synchronisée sur le serveur (tous les appareils affichent la même seconde).
- Messages rapides du topeur vers un poste (« STOP musique », « on attend la TV »…).
