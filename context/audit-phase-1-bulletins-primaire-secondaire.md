# Audit phase 1 — Bulletins primaire et secondaire

**Date :** 13 juillet 2026  
**Statut :** phase 1 terminée  
**Portée :** audit uniquement, sans modification de la logique fonctionnelle.

## 1. Résumé de l’existant

Le projet possède déjà une bonne base commune pour reconnaître les périodes du primaire et du secondaire. La structure académique et plusieurs types connaissent `p5`, `p6` et `exam3`. En revanche, la préparation des totaux, les données générales du bulletin et le dessin PDF restent principalement construits autour de deux semestres.

Le risque principal est donc le suivant : les notes du troisième trimestre peuvent être lues et regroupées, mais elles ne sont pas encore intégrées jusqu’au bout dans les totaux et dans le tableau PDF.

## 2. Matrice de prise en charge actuelle

| Élément | Secondaire | Primaire | Observation |
| --- | --- | --- | --- |
| Définition des périodes | Oui | Oui | `lib/academic-structure.ts` décrit déjà 2 semestres et 3 trimestres. |
| Reconnaissance des clés de période | Oui | Oui | `p1` à `p6` et `exam1` à `exam3` sont reconnus. |
| Agrégation initiale des notes | Oui | Partielle | Les périodes primaires sont collectées, mais la suite du traitement reste limitée. |
| Maxima par période | Oui | Oui | Les neuf clés sont acceptées. |
| Totaux par groupe académique | Oui | Non | Le calcul annuel ne contient que `semester1` et `semester2`. |
| Données générales : place, application, conduite | Oui | Non | Les structures sont encore limitées à `sem1` et `sem2`. |
| Tableau PDF | Oui | Non | Le troisième trimestre est préparé mais n’est pas dessiné. |
| Sélection automatique du format | Non | Non | Le type de branche n’est pas encore transmis au générateur. |

## 3. Éléments exacts à généraliser

### `lib/academic-structure.ts`

Ce fichier est déjà la meilleure source de vérité :

- secondaire : `p1`, `p2`, `exam1`, puis `p3`, `p4`, `exam2` ;
- primaire : `p1`, `p2`, `exam1`, puis `p3`, `p4`, `exam2`, puis `p5`, `p6`, `exam3` ;
- ordre et clés des périodes disponibles via les fonctions existantes.

Il devra piloter les prochaines généralisations afin d’éviter une nouvelle liste de périodes écrite directement dans les composants.

### `lib/bulletin-maxima.ts`

Les maxima par période acceptent déjà `p5`, `p6` et `exam3`. Les limites sont :

- `BulletinYearMaxima` ne contient que `semester1`, `semester2` et `annualTotal` ;
- les constantes de calcul sont limitées aux deux semestres ;
- `calculateBulletinYearMaxima` ignore le troisième trimestre dans les totaux annuels.

À généraliser : calculer les totaux à partir des groupes définis par la structure académique, puis inclure le troisième groupe pour une branche primaire.

### `lib/types/index.ts`

Les types de période connaissent déjà le troisième trimestre, mais les structures du bulletin ne vont pas toutes jusqu’au bout :

- `SemesterKey` accepte déjà `sem3` ;
- `Subject` possède déjà un champ `sem3` optionnel ;
- `TotalKey` ne contient que `tt1`, `tt2` et `tg` ;
- `ApplicationType`, `ApplicationTypes` et plusieurs champs de `TypeFiche` ne contiennent que `sem1` et `sem2` ;
- `SEM_ORDER` est limité aux deux premiers groupes ;
- `getPlaceValue` classe toute période après `p2` dans `sem2`, ce qui rend `p5`, `p6` et `exam3` incorrects ;
- les fonctions de visibilité et de calcul ne couvrent que deux groupes ;
- `drawMatiere` dessine uniquement les deux semestres et le total général.

À généraliser : ajouter le troisième total, rendre les données générales compatibles avec un nombre variable de groupes et faire dépendre le dessin de la structure active.

### `ClassFicheClient.tsx`

La construction du récapitulatif brut est assez générique pour transporter toutes les périodes. `getAggregatedPeriods` peut également ordonner `p5`, `p6` et `exam3`.

Les limites se trouvent dans la préparation finale du bulletin :

- `isSemesterComplete` n’accepte que les groupes 1 et 2 ;
- `periodMap` ne possède ni `p5`, ni `p6`, ni `exam3`, ni `tt3` ;
- `autres` initialise uniquement `sem1` et `sem2` ;
- les totaux ne calculent que `TT1` et `TT2` ;
- le total général est déclenché après le deuxième examen et suppose deux groupes ;
- le classement, la place, l’application et la conduite ne disposent pas d’un troisième groupe.

À généraliser : construire les périodes, totaux et champs généraux en parcourant les groupes académiques actifs au lieu d’utiliser des conditions propres aux deux semestres.

### `components/useBulletinPDF.tsx` et `components/bulletins.tsx`

Les deux générateurs savent collecter `sem3` et associer `p5`, `p6` et `exam3`. Cependant, leur rendu reste limité à deux groupes :

- les en-têtes dessinent explicitement le premier et le deuxième semestre ;
- les coordonnées du total et de l’examen sont dupliquées pour seulement deux groupes ;
- `sem3` n’est jamais dessiné dans le tableau final ;
- le calcul annuel utilisé par le rendu ignore encore le troisième groupe.

Les largeurs importantes sont écrites directement dans les générateurs :

- `colRatios = [0.2, 0.22, 0.22, 0.07, 0.09, 0.02, 0.08]` ;
- `semSubRatios = [0.5, 0.25, 0.25]` ;
- `semPeriodRatios = [0.5, 0.5]` ;
- largeurs séparées `sem1SubWidths` et `sem2SubWidths` ;
- coordonnées séparées `totX1`, `examX1`, `totX2`, `examX2` ;
- plusieurs largeurs fixes, notamment `190`, `34.1`, `16`, `13` et `21`.

À généraliser : introduire une description de mise en page dépendant du type de branche et rendre les groupes dans une boucle. Il faudra aussi réduire les colonnes du secondaire lorsque nécessaire pour garantir l’affichage de maxima à trois chiffres sans casser la structure actuelle.

Les deux fichiers contiennent une logique très proche. La suite devra éviter deux implémentations divergentes du bulletin primaire.

### Contexte de branche et page des fiches

Le contexte sécurisé du bulletin ne transmet pas encore le type de branche jusqu’au générateur. La page des fiches ne sélectionne pas encore `typebranch` dans les données utilisées par le bulletin.

Ce point appartient à la phase 2 : il permettra de choisir automatiquement le format primaire ou secondaire sans choix manuel.

## 4. Risques confirmés

- `p5`, `p6` et `exam3` peuvent être collectés puis omis silencieusement dans le PDF.
- Le total général d’un bulletin primaire serait incomplet car le troisième groupe n’est pas additionné.
- La place et les appréciations du troisième trimestre peuvent être rangées dans le deuxième semestre.
- Ajouter simplement trois colonnes aux largeurs actuelles provoquerait des chevauchements ou une sortie de page.
- Modifier séparément les deux générateurs PDF créerait un risque de divergence.

## 5. Garanties à conserver

- Le secondaire doit rester composé de deux groupes et conserver ses calculs actuels.
- Les maxima restent issus de la pondération réellement configurée.
- La logique de classement et de remplissage existante ne doit pas être remplacée, seulement étendue au troisième groupe.
- Les anciennes fiches doivent rester lisibles même lorsqu’elles ne contiennent pas de données du troisième trimestre.
- Le choix du bulletin devra venir du type de branche vérifié côté serveur.

## 6. Conclusion

La phase 1 est terminée. Aucun fichier fonctionnel n’a été modifié. La phase 2 peut maintenant ajouter le type de branche au contexte sécurisé du bulletin, avant toute modification des calculs ou du dessin PDF.
