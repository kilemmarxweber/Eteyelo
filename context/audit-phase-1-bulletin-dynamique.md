# AUDIT PHASE 1 — Bulletin avec maxima dynamiques

## Statut

Phase 1 exécutée le 13 juillet 2026.

Cette phase est un audit en lecture seule du comportement applicatif. Aucun calcul, composant ou accès aux données n’a été modifié.

## 1. Conclusion générale

La pondération est déjà appliquée dynamiquement lors de la préparation d’une nouvelle fiche :

```text
maximum normal = pondération du cours × 10
maximum examen = maximum normal × 2
```

Le `maxScore` réellement utilisé est enregistré dans le JSON `notes` de la fiche. `ClassFicheClient.tsx` sait déjà lire et additionner ces maxima enregistrés.

La divergence apparaît ensuite dans les deux générateurs PDF. Ils récupèrent bien un `maxScore` depuis les notes, mais le convertissent en un profil fermé (`typeA` à `typeE`) puis reconstruisent les lignes `MAXIMA` avec des nombres statiques. Le bulletin ne peut donc pas gérer correctement toutes les pondérations configurables.

## 2. Parcours actuel de la pondération

### Configuration en base de données

Le modèle `CoursOptionPonderation` contient :

- `branchId` ;
- `coursId` ;
- `optionId` ;
- `ponderation` de type entier.

La contrainte unique est :

```text
[branchId, coursId, optionId]
```

La pondération dépend donc bien de la branche, du cours et de l’option.

### Résolution de la pondération

Le fichier `lib/course-ponderation.ts` :

- charge les pondérations par `branchId`, `coursId` et `optionId` ;
- retourne `1` lorsqu’un cours, une option ou une configuration manque ;
- permet la résolution groupée avec `getCoursePonderationMap`.

### Préparation d’une nouvelle fiche

Dans `notes/page.tsx`, chaque enseignement reçoit :

```text
lesson.maxScore = resolveCoursePonderation(...) × 10
```

Dans `notes/FicheSaisieClient.tsx` :

- `Evaluation`, `Devoir` et `TP` utilisent actuellement un maximum fixe de `10` ;
- une `ficheCote` normale utilise `lesson.maxScore` ;
- une période d’examen utilise `lesson.maxScore × 2` ;
- les périodes d’examen forcent actuellement le type `ficheCote`.

La règle dynamique confirmée pour le bulletin est donc celle des `ficheCote` : pondération × 10, puis doublement pour l’examen.

## 3. Structure exacte des fiches et des notes

Le modèle Prisma `fiche` enregistre notamment :

- `typeFiche` ;
- `coursName` ;
- `classeName` ;
- `periodId` et `periodeName` ;
- `anneeId` et `anneeName` ;
- `notes` sous forme de texte JSON ;
- `autres` sous forme de texte JSON ;
- `branchId` ;
- les relations vers la classe, l’enseignement, la période et l’enseignant.

Après lecture et agrégation, une note utilisée par le bulletin contient :

```ts
{
  score: number;
  maxScore: number;
  periodName: string;
  anneeName: string;
  application?: string;
  connduite?: string;
  comment?: string;
}
```

Le `maxScore` sauvegardé est donc disponible pour servir de valeur historique.

## 4. Calculs déjà dynamiques dans ClassFicheClient

`ClassFicheClient.tsx` effectue déjà les opérations suivantes depuis les notes enregistrées :

- addition des scores par cours ;
- addition des `maxScore` par cours ;
- addition des maxima d’une période ;
- addition des maxima des périodes d’un semestre ;
- calcul des totaux et pourcentages à partir des maxima réels.

Pour un examen sélectionné, `getNotesForPeriods` agrège les périodes précédentes jusqu’à l’examen. Pour une période ordinaire, il conserve uniquement la période sélectionnée.

Cette partie constitue la logique de remplissage à préserver.

## 5. Ancienne logique statique identifiée

### Types fermés

Dans `lib/types/index.ts` :

```ts
type MaxScore = 0 | 10 | 20 | 40 | 50;
type MaximaType = "typeA" | "typeB" | "typeC" | "typeD" | "typeE";
```

Cette union ne représente pas un maximum de `30`, `60`, `70`, etc. Une pondération 3 ou 7 est donc incompatible avec le modèle de type actuel du PDF.

### Profils statiques

`maximaProfiles` définit uniquement :

| Type | Période normale | Examen | Total semestre |
|---|---:|---:|---:|
| typeA | 10 | 20 | 40 |
| typeB | 20 | 40 | 80 |
| typeC | 40 | 80 | 160 |
| typeD | 0 | 0 | 0 |
| typeE | 50 | 100 | 200 |

`getMaximaType` accepte seulement les bases `0`, `10`, `20`, `40` et `50`.

### Conséquence pour une pondération 3

Avec une pondération 3 :

```text
maxScore enregistré = 30
```

Mais `getMaximaType(30)` ne possède aucune correspondance. Le cours ne peut pas être affecté correctement à un bloc de maxima et peut être ignoré par le calcul ou l’affichage du PDF.

## 6. Premier générateur PDF : bulletins.tsx

Le générateur :

1. construit un `subjectMap` depuis toutes les périodes ;
2. copie dans `baseMaxScore` le premier `note.maxScore` trouvé hors examen ;
3. convertit ce maximum en `MaximaType` avec `getMaximaType` ;
4. place le cours dans un bloc correspondant au type ;
5. récupère les valeurs numériques depuis `maximaProfiles` ;
6. calcule les maxima généraux avec :

```text
nombre de cours du bloc × maximum statique du profil
```

7. dessine la ligne `MAXIMA` avec ces valeurs reconstruites.

Le PDF ne somme donc pas directement les `maxScore` propres à chaque cours et chaque période.

## 7. Deuxième générateur PDF : useBulletinPDF.tsx

`useBulletinPDF.tsx` reproduit presque intégralement la même logique :

- même `subjectMap` ;
- même `baseMaxScore` ;
- même appel à `getMaximaType` ;
- mêmes blocs `typeA` à `typeE` ;
- même fonction `computeMaxima` ;
- même multiplication par le nombre de cours ;
- même accumulation pour le bloc `GENERAUX` ;
- même dessin des lignes `MAXIMA`.

Il s’agit d’une duplication fonctionnelle. Corriger un seul générateur laisserait l’autre avec les anciens résultats.

## 8. Valeurs maximales écrites directement dans le code

Les valeurs statiques qui influencent actuellement le parcours sont :

- `10`, `20`, `40`, `50` dans le type `MaxScore` ;
- les maxima des périodes, examens et semestres dans `maximaProfiles` ;
- le multiplicateur `× 2` pour les examens ;
- le maximum `10` pour les fiches `Evaluation`, `Devoir` et `TP` ;
- la valeur de secours `1` pour une pondération manquante, donnant `10` après multiplication.

Le multiplicateur d’examen et le secours de pondération font partie de la logique actuelle. Les profils fermés du PDF sont la partie à remplacer.

## 9. Informations de branche et d’organisation

### Champs disponibles sur Branch

Le modèle `Branch` fournit :

- `name` ;
- `code` facultatif ;
- `image` facultative au format JSON ;
- `adresse` facultative ;
- `ville` facultative ;
- `pays` facultatif ;
- `idnat` et `tel` facultatifs ;
- `organizationId` ;
- la relation `organization`.

### Champs disponibles sur Organization

Le modèle `Organization` fournit notamment :

- `name` ;
- `slug` ;
- `logo` facultatif ;
- `metadata` facultatif.

### Données actuellement chargées par la page

`fiches/page.tsx` récupère actuellement `session` et `branchId`, puis les inscriptions/classes de la branche. La page ne charge pas encore :

- la branche elle-même ;
- son code ;
- son adresse ;
- sa ville et son pays ;
- son image ;
- le nom et le logo de l’organisation.

`organizationId` n’est pas encore extrait du contexte pour une requête de métadonnées de bulletin.

## 10. En-têtes codés en dur

Les deux générateurs PDF contiennent directement :

- `VILLE : KINSHASA` ;
- `COMMUNE : SELEMBAO` ;
- `ECOLE : COLLEGE LA FRATERNITE` ;
- une zone de code vide.

Le fichier `header.tsx` contient une autre identité statique :

- `SPRING OF LIFE INTERNATIONAL CHRISTIAN SCHOOL` ;
- `67, Avenue Nguma BINZA - MACAMPAGNE` ;
- `Kinshasa/Ngaliema` ;
- un site et une page Facebook statiques.

La recherche des appels indique que `drawHeader` est seulement déclaré dans `header.tsx` et n’est actuellement appelé par aucun composant de ce dossier. Les deux générateurs dessinent donc leur propre en-tête en interne.

## 11. Cartographie des remplacements futurs

| Logique actuelle | Limite | Remplacement prévu |
|---|---|---|
| `MaxScore` limité à cinq valeurs | Pondérations arbitraires impossibles | Utiliser `number` validé pour les maxima |
| `getMaximaType(baseMaxScore)` | Aucun type pour 30, 60, 70, etc. | Ne plus grouper numériquement par maximum |
| `maximaProfiles` | Barèmes fermés et statiques | Lire les maxima réels de chaque période |
| `subjectCount × profil` | Suppose que tous les cours du bloc ont le même barème | Additionner les maxima de chaque cours |
| Premier maximum hors examen comme base | Ne représente pas forcément toutes les périodes historiques | Conserver un maximum par cours et par période |
| Deux implémentations du même calcul | Risque de divergence | Helper partagé lors de la phase 2 |
| École, ville et commune codées en dur | Mauvaise branche affichée | Contexte dynamique filtré par organisation et branche |
| `header.tsx` statique et non utilisé | Troisième version d’en-tête | Réutiliser ou remplacer par une source commune |

## 12. Règles confirmées pour la suite

### Source principale

```text
note.maxScore enregistré dans la fiche
```

Cette règle préserve l’historique lorsqu’une pondération change après la création d’une fiche.

### Valeur de secours

Lorsque le `maxScore` est absent, non numérique ou inférieur ou égal à zéro :

```text
pondération actuelle du cours et de l’option × 10
```

Pour un examen, la logique actuelle applique ensuite le doublement.

### Totaux

Les maxima de période, semestre, année et du bloc général devront être obtenus par addition des maxima réels, et non par multiplication d’un profil par un nombre de cours.

## 13. Points de vigilance pour les phases suivantes

1. Les données du bulletin sont aujourd’hui indexées par nom de cours. Deux cours portant le même nom pourraient fusionner dans `subjectMap`. Ce comportement existe déjà et ne doit pas être modifié sans vérifier l’impact sur le remplissage.
2. Le PDF prend le premier maximum hors examen comme `baseMaxScore`. Une structure par période sera nécessaire pour conserver des maxima historiques différents.
3. Les libellés de périodes existent en français et en anglais. La détection et le mapping doivent continuer à accepter les deux variantes.
4. Le cursus trimestriel prévoit `p5`, `p6` et `exam3`, alors que les types `Bloc` et plusieurs calculs sont surtout structurés autour de deux semestres. La correction doit éviter une régression du parcours trimestriel.
5. `Branch.image` est un champ JSON : son format réel devra être vérifié avant de le transmettre comme logo au PDF.
6. Le fallback actuel de pondération est `1`. Il doit rester explicite afin qu’une configuration manquante ne produise pas une division par zéro.
7. Les fiches autres que `ficheCote` ont une règle fixe de maximum 10. Elles ne doivent pas être assimilées automatiquement aux maxima pondérés du bulletin sans vérifier leur rôle exact.

## 14. Fichiers audités

- `context/plan-execution-bulletin-dynamique.md`
- `lib/types/index.ts`
- `lib/course-ponderation.ts`
- `prisma/schema.prisma`
- `notes/page.tsx`
- `notes/FicheSaisieClient.tsx`
- `fiches/page.tsx`
- `fiches/components/ClassFicheClient.tsx`
- `fiches/components/bulletins.tsx`
- `fiches/components/useBulletinPDF.tsx`
- `fiches/components/header.tsx`

## 15. Résultat de la phase 1

La phase 1 est terminée.

La cause principale est confirmée : les fiches possèdent déjà des maxima dynamiques et historiques, mais les deux générateurs PDF les remplacent par des profils numériques statiques au moment de construire les lignes `MAXIMA`.

La phase 2 pourra créer le calcul partagé sans modifier la saisie, les notes enregistrées, le classement ou les autres règles de remplissage.
