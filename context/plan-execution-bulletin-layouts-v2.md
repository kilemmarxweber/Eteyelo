# PLAN D’EXÉCUTION — Layouts bulletin secondaire (restauration) et primaire (simplification)

**Date :** 13 juillet 2026  
**Statut :** 📋 À valider avant exécution  
**Références :**
- `context/bulletins-primaire-secondaire.md`
- Commit git de référence secondaire : `d9bba37` (`useBulletinPDF.tsx` avant extraction phase 5)
- Fichiers actuels : `bulletin-secondary-layout.ts`, `bulletin-primary-layout.ts`, `bulletin-primary-render.ts`

---

## 1. Objectif

Deux changements distincts selon le type de branche :

| Branche | Action |
| --- | --- |
| **SECONDAIRE** | Restaurer l’ancien layout tel qu’il était dans git (`d9bba37`), sans toucher à la logique de calcul |
| **PRIMAIRE** | Conserver le layout trimestriel actuel, mais simplifier les colonnes de fin et enrichir la colonne TOTAL trimestre |

Le choix automatique `Branch.typebranch` reste inchangé.

---

## 2. État actuel vs cible

### 2.1 Bulletin secondaire

#### Layout actuel (phase 5 — `bulletin-secondary-layout.ts`)

```text
Ratios principaux : [0.18, 0.235, 0.235, 0.07, 0.085, 0.02, 0.075]
Sous-colonnes semestre : [0.44, 0.28, 0.28]  →  TR JOURN | EXAM | TOT
Colonne repechage : largeur calculée depuis le ratio (≠ 34.1 mm fixe)
```

#### Layout cible (ancien git `d9bba37`)

```text
Ratios principaux : [0.2, 0.22, 0.22, 0.07, 0.09, 0.02, 0.08]
Sous-colonnes semestre : [0.5, 0.25, 0.25]    →  TR JOURN | EXAM | TOT
Périodes dans TR JOURN : [0.5, 0.5]           →  1eP | 2eP (idem 3eP | 4eP)
Colonne repechage : largeur fixe 34.1 mm
Spacer noir : ~4 mm (ratio 0.02)
En-tête première colonne : « BRANCHES »
```

#### Colonnes conservées (secondaire inchangé fonctionnellement)

```text
BRANCHES | PREMIER SEMESTRE (TR JOURN | EXAM | TOT) | DEUXIEME SEMESTRE | TG | SIGN PROF | [spacer] | EXAMEN DE REPECHAGE (% | Signature)
```

> Le secondaire **ne supprime aucune colonne**. On restaure uniquement les proportions et la largeur fixe du repechage.

---

### 2.2 Bulletin primaire

#### Layout actuel (phase 6)

```text
COURS | 1er TRIM | 2e TRIM | 3e TRIM | TG | SIGN PROF | [spacer] | EXAMEN REPECHAGE (% | Signature)

Chaque trimestre : TR JOURN (1eP, 2eP) | EXAM | TOT
```

#### Layout cible

```text
COURS | 1er TRIM | 2e TRIM | 3e TRIM | TG

Chaque trimestre : TR JOURN (1eP, 2eP) | EXAM | TOTAL (MAX | PTS)
```

#### Colonnes supprimées

| Colonne | Index actuel | Action |
| --- | --- | --- |
| SIGN PROF | 5 | Supprimer |
| Spacer noir | 6 | Supprimer |
| EXAMEN DE REPECHAGE | 7 | Supprimer entièrement |
| % (sous-colonne repechage) | 7a | Supprimer |
| Signature (sous-colonne repechage) | 7b | Supprimer |

L’espace libéré est **redistribué** aux trois groupes trimestriels et à la colonne TG.

#### Colonne TOTAL trimestre — subdivision MAX / PTS

Sur chaque groupe trimestriel, la colonne actuellement libellée `TOT` devient `TOTAL` avec deux sous-cellules :

| Sous-colonne | Contenu | Exemple trimestre 1 |
| --- | --- | --- |
| **MAX** | Somme des maxima du trimestre | `max(P1) + max(P2) + max(EXAM 1)` |
| **PTS** | Total des points obtenus du trimestre | `P1 + P2 + EXAM 1` (via `computeGroupTotal`) |

**En-tête du tableau :**

```text
                    ┌──────── TOTAL ────────┐
TR JOURN | EXAM     │  MAX  │  PTS        │
1eP  2eP            │       │             │
```

La hauteur d’en-tête reste à 3 niveaux (`hTop`, `hMid`, `hBottom`) comme aujourd’hui ; seule la colonne `TOT` est scindée au niveau `hBottom` (ou `hMid + hBottom` selon alignement visuel).

#### Colonne TG — fond noir

La colonne TG finale doit être **noircie** (fond noir, texte blanc ou selon `getColor`) de la même manière que les colonnes spéciales déjà traitées dans `bulletin-primary-render.ts` (`blackFill` pour APPLICATIONS, CONDUITE, etc.).

Cela s’applique à :
- lignes matières (score TG coloré sur fond noir si règle métier le permet, sinon fond noir + texte blanc) ;
- lignes générales (TOTAUX, POURCENTAGES, PLACE, SIGNATURE PARENTS) ;
- ligne maxima (valeur du maximum général sur fond noir).

---

## 3. Plan d’exécution détaillé

### Phase A — Secondaire : restauration git (priorité 1)

**Statut :** ✅ Terminée le 13 juillet 2026

**Fichier principal :** `fiches/components/bulletin-secondary-layout.ts`

| Étape | Action |
| --- | --- |
| A.1 | Remplacer `SECONDARY_MAIN_COL_RATIOS` par `[0.2, 0.22, 0.22, 0.07, 0.09, 0.02, 0.08]` |
| A.2 | Remplacer `SECONDARY_SEM_SUB_RATIOS` par `[0.5, 0.25, 0.25]` |
| A.3 | Restaurer `repechageWidth = 34.1` (constante fixe, pas ratio) |
| A.4 | Conserver `SECONDARY_PERIOD_RATIOS = [0.5, 0.5]` (déjà identique) |
| A.5 | Vérifier que `totX1`, `examX1`, `totX2`, `examX2` restent cohérents avec `drawMatiere` / `drawSubjectRow` dans `lib/types` |
| A.6 | Ne pas modifier `drawSecondaryTableHeader` (libellés, structure) sauf si régression visuelle |

**Fichiers secondaires :**

| Fichier | Action |
| --- | --- |
| `scripts/test-bulletin-layouts.ts` | Adapter le test « repechage ≠ 34.1 » → accepter `34.1` fixe |
| `scripts/test-bulletin-visual-secondary.ts` | Régénérer PDF de référence et comparer visuellement |
| `useBulletinPDF.tsx` | Aucun changement attendu (délègue déjà au layout secondaire) |

**Critères d’acceptation secondaire :**
- [x] Proportions identiques au PDF généré avant phase 5 (`d9bba37`)
- [x] 6 cases d’évaluation lisibles (maxima 1–3 chiffres)
- [x] SIGN PROF, repechage %, Signature présents et positionnés comme avant
- [x] Calculs, classement, appréciations inchangés

---

### Phase B — Primaire : suppression des colonnes de fin (priorité 2)

**Statut :** ✅ Terminée le 13 juillet 2026

**Fichier principal :** `fiches/components/bulletin-primary-layout.ts`

| Étape | Action |
| --- | --- |
| B.1 | Réduire `PRIMARY_MAIN_COL_RATIOS` de 8 à **5 colonnes** : `COURS | TRIM1 | TRIM2 | TRIM3 | TG` |
| B.2 | Proposition de redistribution initiale (à affiner visuellement) : |
| | `[0.17, 0.22, 0.22, 0.22, 0.17]` — l’espace des 3 colonnes supprimées (~0.16) va aux trimestres et TG |
| B.3 | Supprimer du type `PrimaryBulletinLayout` : `repechageWidth`, `repechagePercentWidth`, `repechageSignatureWidth` |
| B.4 | Supprimer dans `drawPrimaryTableHeader` : dessin SIGN PROF, spacer, repechage |
| B.5 | Mettre à jour les index de colonnes (`TG` passe de l’index 4 à l’index **4** — dernier index) |

---

### Phase C — Primaire : colonne TOTAL avec MAX / PTS (priorité 3)

**Statut :** ❌ Annulée — retour au layout phase B (colonne TOT unique)

**Fichiers :** `bulletin-primary-layout.ts`, `bulletin-primary-render.ts`, éventuellement `useBulletinPDF.tsx`

| Étape | Action |
| --- | --- |
| C.1 | Modifier `PRIMARY_TRIM_SUB_RATIOS` : la part `TOT` (index 2) se subdivise en `MAX` et `PTS` |
| | Exemple : `[0.46, 0.27, 0.135, 0.135]` → TR JOURN \| EXAM \| MAX \| PTS |
| C.2 | Étendre `PrimaryTrimesterSubLayout` : |
| | `maxX`, `ptsX`, `maxWidth`, `ptsWidth` (ou tableau `totalSubWidths`) |
| C.3 | Adapter `drawTrimesterHeader` : |
| | - Niveau 2 : libellé `TOTAL` sur la largeur MAX+PTS |
| | - Niveau 3 : sous-libellés `MAX` et `PTS` |
| C.4 | Adapter `drawPrimaryTrimesterMaximaRow` : |
| | - MAX → `tt1` / `tt2` / `tt3` (maxima trimestre) |
| | - PTS → vide sur la ligne maxima (ou tiret) |
| C.5 | Adapter `drawPrimaryMatiere` : |
| | - EXAM inchangé |
| | - MAX → vide pour matières (ou maxima individuel si demandé) |
| | - PTS → `computeGroupTotal` (points obtenus trimestre) |
| C.6 | Adapter `drawPrimarySubjectRow` pour lignes générales : |
| | - TOTAUX : MAX = maxima trimestre, PTS = points obtenus |
| | - POURCENTAGES : MAX vide/noir, PTS = pourcentage trimestre |
| | - APPLICATIONS / CONDUITE : MAX et PTS noircis |
| | - PLACE/NOMBRE : logique actuelle répartie sur MAX/PTS |
| | - SIGNATURE PARENTS : cellules vides sur MAX/PTS |

---

### Phase D — Primaire : TG noirci (priorité 4)

**Fichier :** `bulletin-primary-render.ts`

| Étape | Action |
| --- | --- |
| D.1 | Supprimer `drawPrimaryTrailingColumns` (plus de SIGN PROF / repechage) |
| D.2 | Créer `drawPrimaryTgCell` : une seule cellule TG avec `fill: "black"` |
| D.3 | Texte TG : blanc ou couleur `getColor` selon lisibilité (tester rouge sur noir pour scores faibles) |
| D.4 | Appliquer sur toutes les fonctions de rendu : `drawPrimaryMatiere`, `drawPrimarySubjectRow` |

---

### Phase E — Tests et validation (priorité 5)

| Test | Fichier | Vérification |
| --- | --- | --- |
| Layout secondaire | `scripts/test-bulletin-layouts.ts` | Ratios git, repechage 34.1, 6 eval cells |
| Layout primaire | `scripts/test-bulletin-layouts.ts` | 5 colonnes, 12 eval + 6 total sub-cells, pas de repechage |
| Calculs | `scripts/test-bulletin-calculations.ts` | MAX/PTS cohérents avec maxima dynamiques |
| Isolation | `scripts/test-bulletin-isolation.ts` | Secondaire non impacté par changements primaire |
| Visuel secondaire | `scripts/test-bulletin-visual-secondary.ts` | Comparaison avec snapshot `d9bba37` |
| Visuel primaire | `scripts/test-bulletin-visual-primary.ts` | PDF sans colonnes supprimées, TOTAL scindé, TG noir |

**Validation manuelle :**
1. Générer un bulletin secondaire → comparer avec un PDF archivé pré-phase 5
2. Générer un bulletin primaire → vérifier lisibilité A4, dernière ligne visible
3. Vérifier maxima à 3 chiffres dans cases MAX et PTS

---

## 4. Fichiers impactés (résumé)

| Fichier | Secondaire | Primaire |
| --- | --- | --- |
| `bulletin-secondary-layout.ts` | ✅ Restaurer ratios git | — |
| `bulletin-primary-layout.ts` | — | ✅ Supprimer colonnes, TOTAL MAX/PTS |
| `bulletin-primary-render.ts` | — | ✅ Rendu MAX/PTS, TG noir |
| `useBulletinPDF.tsx` | — | ⚠️ Possible ajustement index/layout |
| `lib/bulletin-layout.ts` | — | — (helpers inchangés) |
| `lib/types/index.ts` | — | — (secondaire utilise toujours drawMatiere) |
| `scripts/test-bulletin-layouts.ts` | ✅ | ✅ |
| `scripts/test-bulletin-visual-*.ts` | ✅ | ✅ |

---

## 5. Risques et mitigations

| Risque | Mitigation |
| --- | --- |
| Primaire trop large après suppression colonnes | Redistribuer progressivement ; test A4 à chaque ratio |
| MAX/PTS trop étroits pour maxima 3 chiffres | Respecter `MIN_EVAL_CELL_WIDTH_MM` ; réduire TR JOURN si besoin |
| TG noir illisible avec texte rouge | Utiliser texte blanc pour scores, rouge uniquement si contraste suffisant |
| Régression secondaire | Tests d’isolation + pas de modification du code primaire dans fichiers secondaires |
| Index de colonnes cassés dans `useBulletinPDF` | Centraliser les index dans le layout, pas de magic numbers |

---

## 6. Ordre d’exécution recommandé

```text
1. Phase A  — Secondaire (restauration git, commit isolé)
2. Phase B  — Primaire (suppression colonnes)
3. Phase C  — Primaire (TOTAL MAX/PTS)
4. Phase D  — Primaire (TG noir)
5. Phase E  — Tests + validation visuelle
```

Chaque phase peut faire l’objet d’un commit séparé pour faciliter la revue.

---

## 7. Schéma visuel cible — Primaire

```text
┌────────┬──────────────── 1er TRIMESTRE ────────────────┬──────────────── 2e TRIMESTRE ────────────────┬──────────────── 3e TRIMESTRE ────────────────┬────┐
│ COURS  │ TR JOURN │ EXAM │    TOTAL    │ TR JOURN │...│ TR JOURN │ EXAM │    TOTAL    │ TR JOURN │...│ TR JOURN │ EXAM │    TOTAL    │ TG │
│        │  1eP 2eP │      │ MAX │ PTS  │  1eP 2eP │...│  3eP 4eP │      │ MAX │ PTS  │  5eP 6eP │...│  5eP 6eP │      │ MAX │ PTS  │████│
├────────┼──────────┼──────┼─────┼──────┼──────────┼...┼──────────┼──────┼─────┼──────┼──────────┼...┼──────────┼──────┼─────┼──────┼████┤
│ FRANÇ  │   12  14 │  28  │     │  54  │   ...    │   │   ...    │      │     │      │   ...    │   │   ...    │      │     │  xxx │████│
│ ...    │          │      │     │      │          │   │          │      │     │      │          │   │          │      │     │      │████│
│ TOTAUX │   ...    │      │ max │ pts  │   ...    │   │   ...    │      │ max │ pts  │   ...    │   │   ...    │      │ max │ pts  │████│
└────────┴──────────┴──────┴─────┴──────┴──────────┴...┴──────────┴──────┴─────┴──────┴──────────┴...┴──────────┴──────┴─────┴──────┴────┘
```

---

## 8. Critères d’acceptation globaux

### Secondaire
- [ ] Layout visuellement identique à `d9bba37`
- [ ] Toutes les colonnes d’origine présentes
- [ ] Aucune régression calcul / classement

### Primaire
- [ ] Colonnes SIGN PROF, %, Signature, Examen repechage absentes
- [ ] Chaque trimestre affiche TOTAL / MAX / PTS
- [ ] MAX = somme des maxima du trimestre
- [ ] PTS = total des points obtenus du trimestre
- [ ] Colonne TG avec fond noir
- [ ] Bulletin lisible sur A4 portrait
- [ ] Secondaire non affecté

---

## 9. Prochaine étape

**Attendre validation de ce plan**, puis exécuter dans l’ordre des phases A → E.

Une fois validé, commencer par la Phase A (secondaire) car elle est isolée et à faible risque de régression croisée.
