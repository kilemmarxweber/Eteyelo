# RAPPORT PHASE 12 — Vérifications techniques

## Statut

Contrôles techniques terminés le 13 juillet 2026.

L’inspection visuelle interactive reste à effectuer, car aucun navigateur intégré ni session Chrome n’était disponible dans l’environnement d’exécution.

## Contrôles réussis

### TypeScript

Commande :

```text
npx tsc --noEmit --pretty false
```

Résultat : réussi, aucune erreur.

### Tests des maxima

Commande :

```text
pnpm test:bulletin-maxima
```

Résultat : 18 tests fonctionnels et historiques réussis.

### Tests du contexte de branche

Commande :

```text
pnpm test:bulletin-context
```

Résultat : 6 tests d’isolation et d’en-tête réussis.

### Lint

Commande :

```text
pnpm lint
```

Résultat : réussi sans erreur.

Trois avertissements préexistants, hors du bulletin, ont été signalés :

- deux attributs ARIA manquants dans `classe/components/classe-form.tsx` ;
- une balise `<img>` dans `student-registration-form.tsx`.

Le script `next lint` est également annoncé comme déprécié par Next.js, mais il s’exécute encore correctement dans la version actuelle du projet.

### Build de production

Commande :

```text
pnpm build
```

Résultat : réussi avec un code de sortie 0.

La route suivante a été compilée :

```text
/admin/organizations/[organizationId]/branches/[branchId]/fiches
```

Un avertissement BullMQ préexistant a été émis depuis `child-processor.js`. Il concerne la file Redis de la fiche centrale et ne provient pas des changements du bulletin.

### Intégrité des différences

Commande :

```text
git diff --check
```

Résultat : aucune erreur d’espace ou de patch. Les messages CRLF/LF sont des avertissements de conversion de fins de ligne sous Windows.

## Vérifications structurelles du PDF

Les contrôles du code confirment :

- colonnes basées sur des proportions fixes du cadre A4 ;
- lignes de maxima de hauteur constante ;
- maxima numériques non limités à un ou deux chiffres ;
- texte de branche limité à la largeur de sa cellule avec réduction contrôlée ;
- images officielles statiques conservées ;
- absence de profils statiques `maximaProfiles` et `getMaximaType` ;
- utilisation du même helper par les deux générateurs.

## Vérification restante

À effectuer dès qu’un navigateur est disponible :

1. ouvrir une branche authentifiée contenant des fiches ;
2. sélectionner une classe, une période et une année ;
3. générer un bulletin individuel ;
4. générer l’export de toute la classe ;
5. vérifier visuellement l’en-tête ;
6. vérifier des maxima à un, deux et trois chiffres ;
7. vérifier l’alignement des périodes, examens, semestres et du total général ;
8. vérifier que les dernières lignes restent dans la page.

La phase 12 ne doit être marquée entièrement terminée qu’après cette inspection visuelle.
