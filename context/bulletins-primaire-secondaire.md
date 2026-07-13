# CONTEXTE ET PLAN D’EXÉCUTION — Bulletins primaire et secondaire

## 1. Objectif

Gérer automatiquement deux formats de bulletin selon le type de la branche :

- branche `SECONDAIRE` : 4 périodes et 2 examens ;
- branche `PRIMAIRE` : 6 périodes et 3 examens de fin de trimestre.

Zone concernée :

```text
app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/
```

Le choix du bulletin doit être automatique. L’utilisateur ne doit pas sélectionner manuellement le type du bulletin.

```text
typebranch = SECONDAIRE → bulletin secondaire uniquement
typebranch = PRIMAIRE   → bulletin primaire uniquement
```

## 2. Règles communes à conserver

Les deux bulletins doivent conserver la logique actuelle :

- priorité au `maxScore` enregistré dans la fiche ;
- pondération actuelle utilisée uniquement comme secours ;
- maintien de l’historique des anciens bulletins ;
- calcul dynamique des maxima ;
- classement des élèves ;
- pourcentages ;
- applications et appréciations ;
- conduite ;
- place et nombre d’élèves ;
- signature des parents ;
- total général ;
- informations dynamiques de la branche ;
- images officielles existantes statiques ;
- isolation avec `organizationId` et `branchId`.

La création d’un bulletin primaire ne doit pas modifier les résultats du bulletin secondaire actuel.

## 3. Bulletin secondaire

### Structure académique

Le secondaire reste organisé en deux semestres.

#### Premier semestre

- première période : `p1` ;
- deuxième période : `p2` ;
- examen du premier semestre : `exam1` ;
- total du premier semestre : `total1`.

#### Deuxième semestre

- troisième période : `p3` ;
- quatrième période : `p4` ;
- examen du deuxième semestre : `exam2` ;
- total du deuxième semestre : `total2`.

#### Total général

```text
total général = total1 + total2
```

### Colonnes attendues

```text
COURS | P1 | P2 | EXAM 1 | TOTAL 1 | P3 | P4 | EXAM 2 | TOTAL 2 | TG
```

Le tableau secondaire doit pouvoir afficher correctement les six colonnes d’évaluation :

```text
P1, P2, EXAM 1, P3, P4, EXAM 2
```

Les cases devront être légèrement réduites et équilibrées pour que les maxima à un, deux ou trois chiffres restent lisibles sans modifier la logique du tableau.

### Calculs

```text
maximum total1 = max(P1) + max(P2) + max(EXAM 1)
maximum total2 = max(P3) + max(P4) + max(EXAM 2)
maximum général = maximum total1 + maximum total2
```

Les maxima ne doivent jamais provenir d’un profil statique.

## 4. Bulletin primaire

### Structure académique

Le primaire est organisé en trois trimestres.

Chaque trimestre contient deux périodes et un examen de fin de trimestre.

#### Premier trimestre

- première période : `p1` ;
- deuxième période : `p2` ;
- examen du premier trimestre : `exam1` ;
- total du premier trimestre : `total1`.

#### Deuxième trimestre

- troisième période : `p3` ;
- quatrième période : `p4` ;
- examen du deuxième trimestre : `exam2` ;
- total du deuxième trimestre : `total2`.

#### Troisième trimestre

- cinquième période : `p5` ;
- sixième période : `p6` ;
- examen du troisième trimestre : `exam3` ;
- total du troisième trimestre : `total3`.

#### Total général

```text
total général = total1 + total2 + total3
```

### Colonnes attendues

```text
COURS
| P1 | P2 | EXAM 1 | TOTAL 1
| P3 | P4 | EXAM 2 | TOTAL 2
| P5 | P6 | EXAM 3 | TOTAL 3
| TG
```

Le bulletin primaire ajoute donc :

- `p5` ;
- `p6` ;
- `exam3` ;
- `total3`.

### Calculs

```text
maximum total1 = max(P1) + max(P2) + max(EXAM 1)
maximum total2 = max(P3) + max(P4) + max(EXAM 2)
maximum total3 = max(P5) + max(P6) + max(EXAM 3)

maximum général = maximum total1 + maximum total2 + maximum total3
```

Pour les points obtenus :

```text
total1 = P1 + P2 + EXAM 1
total2 = P3 + P4 + EXAM 2
total3 = P5 + P6 + EXAM 3
total général = total1 + total2 + total3
```

Le pourcentage reste :

```text
pourcentage = points obtenus / maximum réel × 100
```

## 5. Adaptation du tableau primaire

Le format A4 doit rester lisible malgré l’ajout d’un troisième trimestre.

### Ajustements proposés

- conserver une colonne `COURS` suffisamment large ;
- réduire légèrement la largeur des colonnes de périodes ;
- donner une largeur un peu supérieure aux colonnes `TOTAL` ;
- conserver une colonne `TG` distincte ;
- réduire la taille de police uniquement si le contenu dépasse ;
- accepter les maxima à un, deux et trois chiffres ;
- utiliser les mêmes hauteurs de lignes que le bulletin secondaire lorsque possible ;
- ne pas supprimer les colonnes générales existantes ;
- empêcher tout dépassement horizontal de la page A4 ;
- vérifier que la dernière ligne reste visible verticalement.

### Proposition de proportions

Les proportions exactes seront validées visuellement, mais l’ordre recommandé est :

```text
COURS : largeur principale
PÉRIODE : petite largeur
EXAMEN : largeur moyenne
TOTAL TRIMESTRE : largeur moyenne
TG : largeur moyenne
AUTRES COLONNES : largeur minimale lisible
```

Les largeurs devront être calculées depuis la largeur réelle de la page et non écrites plusieurs fois directement dans le code.

## 6. Sélection automatique du bulletin

Le champ Prisma déjà disponible est :

```text
Branch.typebranch
```

Valeurs gérées :

```text
PRIMAIRE
SECONDAIRE
```

Le contexte transmis au client devra contenir :

```ts
type BulletinBranchContext = {
  organizationName: string;
  branchName: string;
  branchCode: string;
  address: string;
  city: string;
  country: string;
  logoUrl: string;
  branchType: "PRIMAIRE" | "SECONDAIRE";
};
```

La sélection se fera au niveau du composant principal :

```text
si branchType = PRIMAIRE
  utiliser le moteur de dessin primaire
sinon
  utiliser le moteur de dessin secondaire
```

Le type doit venir de la branche vérifiée avec `organizationId` et `branchId`. Il ne doit pas être déduit du nombre de périodes existantes ni d’une valeur fournie librement par le navigateur.

## 7. Architecture recommandée

Éviter de créer une troisième copie complète du générateur actuel.

Séparer les responsabilités :

```text
BulletinPDF
├── sélection automatique selon branchType
├── données et calculs communs
├── rendu secondaire
└── rendu primaire
```

Fichiers possibles :

```text
fiches/components/BulletinPDF.tsx
fiches/components/bulletin-secondary-layout.ts
fiches/components/bulletin-primary-layout.ts
lib/bulletin-maxima.ts
lib/bulletin-context.ts
lib/bulletin-layout.ts
```

Les calculs doivent rester dans les helpers communs. Les fichiers primaire et secondaire doivent principalement gérer les colonnes, positions et libellés.

## 8. Données académiques à utiliser

Le projet possède déjà une structure académique par type de branche dans :

```text
lib/academic-structure.ts
```

Elle définit déjà :

### Secondaire

```text
p1, p2, exam1, p3, p4, exam2
```

### Primaire

```text
p1, p2, exam1, p3, p4, exam2, p5, p6, exam3
```

Cette structure doit devenir la source commune pour :

- l’ordre des colonnes ;
- les périodes actives ;
- le regroupement par semestre ou trimestre ;
- la détection des examens ;
- le calcul des totaux ;
- la sélection des données visibles.

Il faut éviter de maintenir une autre liste différente directement dans chaque générateur PDF.

## 9. Plan d’exécution ordonné

### Phase 1 — Audit des limites actuelles

**Statut : terminée le 13 juillet 2026.**  
**Rapport :** `context/audit-phase-1-bulletins-primaire-secondaire.md`

1. Identifier toutes les structures limitées à deux semestres.
2. Identifier les types ne contenant que `sem1` et `sem2`.
3. Identifier les fonctions limitées à `p1`, `p2`, `p3`, `p4`, `exam1` et `exam2`.
4. Identifier les largeurs de colonnes écrites directement dans les générateurs.
5. Vérifier la gestion actuelle de `p5`, `p6` et `exam3` dans `ClassFicheClient`.

Résultat attendu : liste exacte des éléments à rendre génériques avant de dessiner le primaire.

### Phase 2 — Ajouter le type de branche au contexte du bulletin

1. Sélectionner `typebranch` dans la requête sécurisée de la branche.
2. Ajouter `branchType` dans `BulletinBranchContext`.
3. Transmettre ce champ à `ClassFicheClient` et au générateur PDF.
4. Ajouter des tests pour `PRIMAIRE` et `SECONDAIRE`.

Résultat attendu : le client connaît le type vérifié de la branche.

### Phase 3 — Généraliser les groupes académiques

1. Utiliser `lib/academic-structure.ts` comme source de vérité.
2. Créer une représentation commune d’un groupe académique.
3. Gérer deux groupes pour le secondaire.
4. Gérer trois groupes pour le primaire.
5. Généraliser les totaux de groupe et le total annuel.

Résultat attendu : les calculs ne sont plus limités à deux semestres.

### Phase 4 — Étendre les types et données du bulletin

1. Ajouter `p5`, `p6`, `exam3` et `total3` aux structures nécessaires.
2. Étendre les champs généraux du primaire : totaux, pourcentages, places, applications, conduite et signatures.
3. Préserver la compatibilité des anciennes fiches secondaires.
4. Gérer les périodes absentes sans produire `NaN` ou une division par zéro.

Résultat attendu : les données du primaire arrivent entièrement jusqu’au moteur PDF.

### Phase 5 — Stabiliser le bulletin secondaire

1. Isoler le dessin secondaire dans son propre layout.
2. Conserver les 4 périodes et 2 examens actuels.
3. Rééquilibrer les six cases d’évaluation.
4. Tester les maxima à un, deux et trois chiffres.
5. Vérifier que les lignes générales et le total général restent identiques.

Résultat attendu : aucun changement de logique pour les branches secondaires et tableau plus lisible.

### Phase 6 — Créer le layout primaire

1. Reprendre l’identité visuelle du bulletin secondaire.
2. Créer trois groupes de colonnes pour les trimestres.
3. Ajouter `P5`, `P6`, `EXAM 3` et `TOTAL 3`.
4. Recalculer toutes les positions depuis la largeur disponible.
5. Conserver les colonnes générales essentielles.
6. Empêcher le dépassement de la page A4.

Résultat attendu : bulletin primaire complet avec 6 périodes et 3 examens.

### Phase 7 — Sélection automatique du layout

1. Créer un composant ou une fonction de routage interne.
2. Utiliser le layout primaire lorsque `branchType = PRIMAIRE`.
3. Utiliser le layout secondaire lorsque `branchType = SECONDAIRE`.
4. Ne pas afficher de sélecteur manuel.
5. Refuser silencieusement toute valeur non gérée en utilisant le secondaire comme fallback sécurisé, selon la normalisation existante.

Résultat attendu : une branche ne voit que son propre type de bulletin.

### Phase 8 — Tests fonctionnels des calculs

Tester le secondaire :

- 4 périodes ;
- 2 examens ;
- 2 totaux de semestre ;
- total général ;
- maxima dynamiques.

Tester le primaire :

- 6 périodes ;
- 3 examens ;
- 3 totaux de trimestre ;
- total général ;
- maxima dynamiques.

Tester également :

- anciennes fiches ;
- périodes manquantes ;
- maxima absents ;
- maxima à trois chiffres ;
- plusieurs pondérations dans le même bulletin.

Résultat attendu : calculs automatisés réussis pour les deux types.

### Phase 9 — Tests de sélection et d’isolation

1. Tester une branche primaire et une branche secondaire de la même organisation.
2. Vérifier que chaque branche utilise le bon layout.
3. Vérifier le filtre `organizationId + branchId`.
4. Vérifier qu’un changement d’URL ne permet pas d’utiliser le type d’une autre branche.
5. Vérifier les informations d’en-tête de chaque branche.

Résultat attendu : aucune confusion entre les branches et les formats.

### Phase 10 — Contrôle visuel secondaire

1. Générer un bulletin secondaire individuel.
2. Générer un export de classe.
3. Vérifier les six cases d’évaluation.
4. Vérifier les maxima à un, deux et trois chiffres.
5. Vérifier la dernière ligne et le bas de page.

Résultat attendu : bulletin secondaire lisible et sans régression.

### Phase 11 — Contrôle visuel primaire

1. Générer un bulletin primaire individuel.
2. Générer un export de classe.
3. Vérifier les neuf cases d’évaluation.
4. Vérifier les trois totaux trimestriels.
5. Vérifier le total général.
6. Vérifier la dernière ligne et le bas de page.
7. Vérifier qu’aucun texte ou nombre ne se chevauche.

Résultat attendu : bulletin primaire lisible sur une page A4.

### Phase 12 — Vérifications techniques finales

1. Exécuter TypeScript.
2. Exécuter le lint.
3. Exécuter les tests des maxima.
4. Exécuter les tests des layouts et du type de branche.
5. Exécuter le build de production.
6. Vérifier les imports et les anciens fichiers devenus inutiles.

Résultat attendu : aucune erreur technique ou duplication dangereuse.

### Phase 13 — Validation finale

La fonctionnalité sera terminée si :

- une branche secondaire reçoit uniquement le bulletin secondaire ;
- une branche primaire reçoit uniquement le bulletin primaire ;
- le secondaire affiche 4 périodes et 2 examens ;
- le primaire affiche 6 périodes et 3 examens ;
- chaque groupe de deux périodes se termine par son examen ;
- les maxima sont dynamiques ;
- les anciennes fiches restent compatibles ;
- le classement et les appréciations restent corrects ;
- les deux formats sont lisibles sur A4 ;
- aucun choix manuel de type de bulletin n’est nécessaire ;
- les données restent isolées par organisation et branche.

## 10. Fichiers probablement concernés

```text
app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/page.tsx
app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/ClassFicheClient.tsx
app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/useBulletinPDF.tsx
app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/bulletins.tsx
lib/academic-structure.ts
lib/bulletin-context.ts
lib/bulletin-maxima.ts
lib/types/index.ts
scripts/test-bulletin-maxima.ts
scripts/test-bulletin-context.ts
```

Nouveaux fichiers possibles :

```text
fiches/components/bulletin-primary-layout.ts
fiches/components/bulletin-secondary-layout.ts
lib/bulletin-layout.ts
scripts/test-bulletin-layouts.ts
```

## 11. Décisions recommandées

1. Conserver un seul bouton de génération de bulletin.
2. Sélectionner automatiquement le layout depuis `Branch.typebranch`.
3. Garder les calculs dans des helpers communs.
4. Créer deux layouts visuels distincts sans dupliquer toute la logique métier.
5. Utiliser `lib/academic-structure.ts` pour l’ordre des périodes.
6. Conserver le format A4 portrait dans un premier temps.
7. N’envisager le paysage que si les tests visuels démontrent que le primaire est illisible en portrait malgré la réduction des colonnes.

## 12. Point de validation avant exécution

La règle proposée est :

> Le type de bulletin est déterminé automatiquement et uniquement par `Branch.typebranch`. Le secondaire conserve 4 périodes et 2 examens. Le primaire utilise 6 périodes et 3 examens, avec un examen après chaque groupe de deux périodes.

Aucun changement de code pour cette nouvelle fonctionnalité ne doit commencer avant validation de ce document.
