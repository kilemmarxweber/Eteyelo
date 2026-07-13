# PLAN D’EXÉCUTION — Bulletin avec maxima dynamiques

## 1. But du plan

Rendre les maxima du bulletin entièrement dynamiques à partir des pondérations appliquées aux cours, afficher les informations réelles de la branche et préserver la logique actuelle de création, de remplissage et de validation des fiches.

Document de référence :

- `context/bulletin-dynamique.md`

Zone concernée :

- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/`

## 2. Principes à respecter

- Ne pas réécrire la logique de saisie des notes.
- Ne pas modifier les notes déjà enregistrées.
- Ne pas recalculer rétroactivement les anciennes fiches avec une nouvelle pondération.
- Utiliser en priorité le `maxScore` enregistré dans chaque fiche.
- Utiliser la pondération actuelle uniquement comme valeur de secours.
- Toujours filtrer les données avec `organizationId` et `branchId`.
- Conserver le tableau, le classement, les observations et le format général du bulletin.
- Centraliser le calcul pour éviter des résultats différents entre les générateurs PDF.

## 3. Phase 1 — Audit final avant modification

**Statut : terminée le 13 juillet 2026.**

Rapport détaillé : `context/audit-phase-1-bulletin-dynamique.md`

### Actions

1. Identifier tous les endroits qui calculent ou affichent un maximum dans les bulletins.
2. Comparer les calculs de `bulletins.tsx` et de `useBulletinPDF.tsx`.
3. Identifier les utilisations de :
   - `maximaProfiles` ;
   - `getMaximaType` ;
   - `MaximaType` ;
   - valeurs maximales écrites directement dans le code.
4. Vérifier la structure exacte des notes enregistrées dans les fiches.
5. Vérifier la différence entre une période normale et un examen.
6. Vérifier les champs disponibles sur la branche et l’organisation.

### Résultat attendu

Une liste complète des anciennes règles statiques et de leurs remplacements dynamiques, sans modification fonctionnelle à cette étape.

## 4. Phase 2 — Définition du calcul partagé

**Statut : terminée le 13 juillet 2026.**

Implémentation : `lib/bulletin-maxima.ts`

### Actions

Créer un helper partagé, par exemple :

```text
lib/bulletin-maxima.ts
```

Ce helper devra fournir des fonctions pour :

- valider un `maxScore` enregistré ;
- résoudre le maximum d’un cours ;
- additionner les maxima par période ;
- calculer les maxima du premier semestre ;
- calculer les maxima du deuxième semestre ;
- calculer le maximum annuel ;
- calculer un pourcentage sans division par zéro.

### Ordre de résolution d’un maximum

1. `note.maxScore` enregistré et supérieur à zéro ;
2. pondération actuelle du cours correspondant à l’option et à la branche ;
3. valeur de secours compatible avec le comportement actuel.

### Règles de calcul

```text
fiche normale = pondération × 10
examen = pondération × 20, selon la logique actuelle confirmée
```

Le helper ne devra jamais modifier une note ou une fiche en base de données.

### Résultat attendu

Une seule source de calcul des maxima, réutilisable partout dans le bulletin.

## 5. Phase 3 — Préparation des informations de la branche

**Statut : terminée le 13 juillet 2026.**

Contexte partagé : `lib/bulletin-context.ts`

### Actions

1. Charger la branche dans `fiches/page.tsx`.
2. Filtrer la requête avec :
   - `branchId` ;
   - `organizationId`.
3. Sélectionner uniquement les champs nécessaires :
   - nom de l’organisation ;
   - nom de la branche ;
   - code ;
   - adresse ;
   - ville ;
   - pays ;
   - logo de la branche ;
   - logo de l’organisation si disponible.
4. Créer un type partagé `BulletinBranchContext`.
5. Passer ce contexte depuis la page vers `ClassFicheClient`.
6. Transmettre ensuite le contexte aux générateurs de bulletins.

### Sécurité

Une branche ne doit jamais être chargée uniquement avec `branchId` lorsque `organizationId` est disponible.

### Résultat attendu

Les générateurs PDF reçoivent les informations vérifiées de la branche active.

## 6. Phase 4 — Intégration dans la préparation des données

**Statut : terminée le 13 juillet 2026.**

La préparation utilise désormais le maximum historique avec fallback sur la pondération du cours.

### Actions

1. Conserver la construction actuelle de `bulletinDataForPDF`.
2. Vérifier que chaque cours transmet son `maxScore` réel pour chaque période.
3. Ajouter les valeurs de secours uniquement lorsque le maximum est absent ou invalide.
4. Calculer les totaux maximums avec le helper partagé.
5. Ne pas modifier :
   - les points obtenus ;
   - les classements ;
   - les observations ;
   - les décisions ;
   - les mentions ;
   - les données de l’élève.

### Résultat attendu

Les données envoyées au PDF contiennent les maxima réels et cohérents pour chaque cours et chaque période.

## 7. Phase 5 — Correction du premier générateur PDF

**Statut : terminée le 13 juillet 2026.**

`bulletins.tsx` utilise désormais les maxima historiques réels par cours et par période.

### Fichier principal

- `fiches/components/bulletins.tsx`

### Actions

1. Remplacer les calculs numériques basés sur `maximaProfiles`.
2. Générer la ligne `MAXIMA` depuis les valeurs réelles des cours.
3. Calculer les totaux par période, semestre et année dynamiquement.
4. Permettre les pondérations non prévues, par exemple 3, 4 ou 7.
5. Conserver les regroupements visuels utiles, mais les rendre indépendants de la valeur numérique du maximum.
6. Utiliser le contexte réel de la branche dans l’en-tête.

### Résultat attendu

Le PDF principal affiche les maxima correspondant exactement aux fiches enregistrées.

## 8. Phase 6 — Correction du deuxième générateur PDF

### Fichier principal

- `fiches/components/useBulletinPDF.tsx`

### Actions

1. Supprimer la duplication des calculs statiques.
2. Réutiliser le même helper que `bulletins.tsx`.
3. Appliquer les mêmes règles de période, semestre et année.
4. Utiliser le même contexte de branche.
5. Vérifier que les deux générateurs donnent les mêmes maxima pour une même fiche.

### Résultat attendu

Aucune différence de calcul entre les deux modes de génération du bulletin.

## 9. Phase 7 — En-tête dynamique du bulletin

**Statut : terminée le 13 juillet 2026.**

Les informations textuelles sont dynamiques. Les images officielles existantes restent statiques conformément à la demande.

### Fichiers probables

- `fiches/components/header.tsx`
- `fiches/components/bulletins.tsx`
- `fiches/components/useBulletinPDF.tsx`

### Actions

1. Retirer les informations d’établissement écrites directement dans le code.
2. Afficher :
   - le nom de la branche ;
   - le code de la branche ;
   - l’adresse complète ;

3. Ne pas afficher de ligne vide ou de libellé inutile lorsqu’une information facultative est absente.

### Résultat attendu

Chaque bulletin identifie correctement la branche qui l’a produit.

## 10. Phase 8 — Nettoyage de l’ancienne logique statique

**Statut : terminée le 13 juillet 2026.**

Les profils, catégories et types fermés de maxima ont été retirés du code source et de l’ancien artefact compilé.

### Actions

1. Retirer les imports devenus inutiles.
2. Ne supprimer `maximaProfiles` et `getMaximaType` que s’ils ne sont plus utilisés ailleurs.
3. Si ces éléments restent nécessaires pour la présentation, documenter qu’ils ne servent plus aux calculs numériques.
4. Vérifier qu’aucun maximum statique ne subsiste dans le parcours du bulletin.

### Résultat attendu

Le calcul du bulletin ne dépend plus d’une liste fermée de maxima.

## 11. Phase 9 — Tests fonctionnels des calculs

**Statut : terminée le 13 juillet 2026.**

Commande reproductible : `pnpm test:bulletin-maxima` — 15 tests réussis.

### Cas à vérifier

1. Cours de pondération 1 : maximum attendu 10 pour une fiche normale.
2. Cours de pondération 2 : maximum attendu 20.
3. Cours de pondération 3 : maximum attendu 30.
4. Examen avec pondération 2 : maximum attendu selon la règle actuelle d’examen.
5. Plusieurs cours avec des pondérations différentes.
6. Cours sans pondération actuelle mais avec `maxScore` enregistré.
7. Fiche sans `maxScore` valide avec une pondération actuelle disponible.
8. Division par zéro impossible lorsque le maximum est absent.
9. Total du semestre égal à la somme de ses périodes et de son examen.
10. Total annuel égal à la somme des deux semestres.

### Résultat attendu

Tous les totaux et pourcentages correspondent aux maxima réellement affichés.

## 12. Phase 10 — Tests de compatibilité historique

**Statut : terminée le 13 juillet 2026.**

Les scénarios historiques sont intégrés à `pnpm test:bulletin-maxima` — 18 tests fonctionnels et historiques réussis.

### Scénario principal

1. Créer ou utiliser une ancienne fiche avec pondération 2 et maximum enregistré à 20.
2. Modifier la pondération actuelle du cours à 3.
3. Générer l’ancien bulletin.
4. Vérifier que l’ancien bulletin reste à 20.
5. Créer une nouvelle fiche.
6. Vérifier que la nouvelle fiche utilise 30.

### Résultat attendu

Les changements de configuration ne réécrivent pas l’historique scolaire.

## 13. Phase 11 — Tests d’isolation et d’en-tête

**Statut : terminée le 13 juillet 2026.**

Commande reproductible : `pnpm test:bulletin-context` — 6 tests réussis. La requête serveur reste filtrée simultanément par `organizationId` et `branchId`.

### Cas à vérifier

- deux branches appartenant à la même organisation ;
- branches ayant des noms, codes et adresses différents ;
- branche sans code ;
- branche sans adresse ;
- tentative d’utiliser un `branchId` appartenant à une autre organisation.

### Résultat attendu

Le bulletin affiche uniquement les informations de la branche autorisée et gère proprement les champs facultatifs.

## 14. Phase 12 — Vérifications techniques

**Statut : contrôles automatisés terminés le 13 juillet 2026 ; inspection visuelle en attente d’un navigateur disponible.**

Rapport : `context/rapport-phase-12-bulletin-dynamique.md`

### Actions

1. Exécuter le contrôle TypeScript.
2. Exécuter le lint sur les fichiers concernés.
3. Vérifier les erreurs de compilation.
4. Vérifier les imports inutilisés.
5. Générer plusieurs bulletins de test.
6. Inspecter visuellement le tableau et l’en-tête du PDF.
7. Vérifier que les colonnes restent alignées avec des maxima à un, deux ou trois chiffres.

### Résultat attendu

Aucune erreur TypeScript ou de rendu et aucune régression visible dans le bulletin.

## 15. Phase 13 — Validation finale

La modification sera considérée comme terminée si :

- les maxima proviennent des valeurs enregistrées dans les fiches ;
- la pondération actuelle sert uniquement de secours ;
- les anciennes fiches conservent leurs maxima historiques ;
- les périodes, semestres et totaux annuels sont cohérents ;
- les deux générateurs PDF donnent les mêmes résultats ;
- le nom, le code et l’adresse de la branche sont affichés ;
- les données sont filtrées avec `organizationId` et `branchId` ;
- la saisie et le remplissage actuels n’ont pas changé ;
- aucune valeur maximale statique ne fausse le résultat ;
- le bulletin reste lisible et conserve son organisation actuelle.

## 16. Ordre conseillé des modifications

1. Audit final des calculs existants.
2. Création du helper de maxima.
3. Chargement du contexte de branche.
4. Transmission des données jusqu’aux générateurs PDF.
5. Correction de `bulletins.tsx`.
6. Correction de `useBulletinPDF.tsx`.
7. Mise à jour de l’en-tête.
8. Nettoyage des anciennes constantes statiques.
9. Tests des calculs.
10. Tests historiques.
11. Tests d’isolation des branches.
12. Contrôles TypeScript et visuels.

## 17. Fichiers prévus

### Fichiers à modifier

- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/page.tsx`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/ClassFicheClient.tsx`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/bulletins.tsx`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/useBulletinPDF.tsx`
- `app/admin/organizations/[organizationId]/branches/(no-layout)/[branchId]/fiches/components/header.tsx`
- éventuellement `lib/types/index.ts`

### Nouveau fichier possible

- `lib/bulletin-maxima.ts`

## 18. Point de validation avant exécution

La règle recommandée est la suivante :

> Le bulletin utilise d’abord le `maxScore` enregistré dans la fiche afin de préserver l’historique. La pondération actuelle du cours est utilisée uniquement lorsque cette valeur est absente ou invalide.

L’exécution du code pourra commencer après validation de cette règle et de ce plan.
