# CONTEXTE — Bulletin avec maxima dynamiques

## 1. Objectif

Améliorer les bulletins dans :

`app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/`

Les améliorations concernent :

- les maxima calculés depuis la pondération configurée de chaque cours ;
- les informations réelles de la branche dans l’en-tête ;
- la conservation complète de la logique actuelle de remplissage des bulletins ;
- la compatibilité avec les anciennes fiches déjà créées.

## 2. Situation actuelle

### Saisie et calcul des notes

La création des fiches utilise déjà une pondération dynamique.

Pour une fiche normale :

```text
maxScore = pondération du cours × 10
```

Exemples :

- pondération 1 → maximum 10 ;
- pondération 2 → maximum 20 ;
- pondération 3 → maximum 30.

Pour un examen, la logique actuelle peut doubler le maximum :

```text
maxScore examen = pondération du cours × 20
```

Les valeurs `maxScore` sont ensuite enregistrées avec les notes de la fiche.

Cette logique de création et de remplissage doit être conservée.

### Problème identifié

Le problème se situe principalement dans la génération du bulletin PDF.

Le bulletin utilise encore des profils statiques provenant de :

- `maximaProfiles` ;
- `getMaximaType` ;
- catégories de maxima prédéfinies.

Cela peut produire un maximum incorrect lorsqu’un cours possède une pondération différente des profils prévus.

Exemple :

- le cours est configuré avec une pondération de 3 ;
- la fiche enregistre correctement un maximum de 30 ;
- le PDF peut encore le classer ou le calculer selon un ancien profil statique.

## 3. Source de vérité proposée

Pour éviter de modifier l’historique scolaire, la source principale du maximum sera :

```text
note.maxScore enregistré dans la fiche
```

Cette valeur représente la pondération appliquée au moment où la fiche a été créée.

Ordre de résolution proposé :

1. utiliser le `maxScore` enregistré dans la fiche ;
2. si le `maxScore` est absent ou égal à zéro, rechercher la pondération actuelle du cours ;
3. calculer le maximum selon le type de fiche ;
4. si aucune pondération n’existe, appliquer un maximum de secours clairement défini.

Cette solution évite qu’une modification récente de la pondération change les anciens bulletins.

## 4. Calcul dynamique des maxima

Pour chaque cours et chaque période :

```text
maximum période = somme des maxScore du cours pour la période
```

Pour le premier semestre :

```text
maximum semestre 1 =
maximum période 1
+ maximum période 2
+ maximum examen 1
```

Pour le deuxième semestre :

```text
maximum semestre 2 =
maximum période 3
+ maximum période 4
+ maximum examen 2
```

Pour l’année :

```text
maximum annuel =
maximum semestre 1
+ maximum semestre 2
```

Le total général doit être calculé en additionnant les maxima réels de tous les cours affichés.

Les pourcentages restent calculés ainsi :

```text
pourcentage = total obtenu / maximum réel × 100
```

## 5. Regroupement des cours

La valeur du maximum ne doit plus déterminer à elle seule le groupe visuel du cours.

Un cours avec une pondération inhabituelle, par exemple 3, 4 ou 7, doit être affiché normalement sans dépendre d’une liste de maxima statiques.

Les anciens profils pourront être conservés uniquement pour la présentation si nécessaire, mais plus pour calculer les nombres de la ligne `MAXIMA`.

## 6. Informations de la branche

L’en-tête du bulletin utilisera les informations de la branche sélectionnée :

- nom de l’organisation ;
- nom de la branche ;
- code de la branche ;
- adresse ;
- ville ;
- pays ;
- logo de la branche, lorsqu’il existe.

Présentation proposée :

```text
NOM DE L’ORGANISATION
Nom de la branche
Code : BR-001
Adresse : 67, Avenue Exemple, Kinshasa
```

Ordre de secours pour le logo :

1. logo de la branche ;
2. logo de l’organisation ;
3. image par défaut actuelle.

La branche devra être recherchée avec les deux identifiants :

- `organizationId` ;
- `branchId`.

Cela empêchera l’affichage des informations d’une autre organisation ou branche.

## 7. Logique à conserver

Les éléments suivants ne seront pas réécrits :

- la création des fiches ;
- la saisie des notes ;
- la sauvegarde automatique ;
- la validation des fiches ;
- le calcul des totaux obtenus ;
- la logique des périodes et des semestres ;
- la génération des observations ;
- le classement ;
- le remplissage actuel du bulletin ;
- la structure générale du tableau du bulletin.

L’intervention sera limitée à :

- la détermination des maxima du PDF ;
- les totaux maximums ;
- les informations de l’en-tête ;
- la suppression de la dépendance numérique aux maxima statiques.

## 8. Organisation technique proposée

Créer un helper commun, par exemple :

```text
lib/bulletin-maxima.ts
```

Il sera chargé de :

- lire le `maxScore` enregistré ;
- utiliser la pondération comme valeur de secours ;
- calculer les maxima par période ;
- calculer les maxima des semestres ;
- calculer le maximum annuel ;
- fournir les mêmes résultats aux deux générateurs PDF.

Cela évitera d’avoir deux calculs différents dans :

- `bulletins.tsx` ;
- `useBulletinPDF.tsx`.

Créer également un type partagé :

```text
BulletinBranchContext
```

Avec les champs suivants :

- `organizationName` ;
- `branchName` ;
- `branchCode` ;
- `address` ;
- `city` ;
- `country` ;
- `logo`.

## 9. Fichiers probablement concernés

- `fiches/page.tsx`
- `fiches/components/ClassFicheClient.tsx`
- `fiches/components/bulletins.tsx`
- `fiches/components/useBulletinPDF.tsx`
- `fiches/components/header.tsx`
- `lib/types/index.ts`
- nouveau helper éventuel : `lib/bulletin-maxima.ts`

## 10. Vérifications nécessaires

Les tests devront couvrir :

- cours avec pondération 1 ;
- cours avec pondération 2 ;
- cours avec pondération 3 ou supérieure ;
- cours sans pondération ;
- fiche normale ;
- fiche d’examen ;
- premier et deuxième semestre ;
- total annuel ;
- anciennes fiches ;
- modification d’une pondération après création d’une fiche ;
- informations et logo de la bonne branche ;
- isolation par `organizationId` et `branchId`.

## 11. Règle recommandée pour l’historique

Une ancienne fiche doit conserver les maxima enregistrés lors de sa création.

Exemple :

- une fiche est créée avec une pondération de 2, donc maximum 20 ;
- la pondération du cours passe ensuite à 3 ;
- l’ancien bulletin reste sur 20 ;
- les nouvelles fiches utilisent 30.

Cette règle protège l’historique des bulletins et évite de modifier rétroactivement les résultats.

## 12. Résumé de l’intervention future

La pondération est déjà dynamique pendant la création des fiches, mais la génération PDF conserve encore une logique de maxima statiques.

La correction future devra utiliser en priorité le `maxScore` enregistré, sans modifier la logique actuelle de remplissage du bulletin.
