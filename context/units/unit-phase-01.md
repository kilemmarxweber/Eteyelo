# Unité — Phase 1 : Audit des limites actuelles

**Source :** [bulletins-primaire-secondaire.md](../bulletins-primaire-secondaire.md) §9  
**Rapport d'audit :** [audit-phase-1-bulletins-primaire-secondaire.md](../audit-phase-1-bulletins-primaire-secondaire.md)  
**Statut :** ✅ Terminée (13 juillet 2026)  
**Type :** audit uniquement — aucune modification fonctionnelle

## Objectif

Identifier précisément tout ce qui est encore limité à deux semestres avant d'implémenter le bulletin primaire.

## Tâches

- [x] Identifier toutes les structures limitées à deux semestres
- [x] Identifier les types ne contenant que `sem1` et `sem2`
- [x] Identifier les fonctions limitées à `p1`, `p2`, `p3`, `p4`, `exam1` et `exam2`
- [x] Identifier les largeurs de colonnes écrites directement dans les générateurs
- [x] Vérifier la gestion actuelle de `p5`, `p6` et `exam3` dans `ClassFicheClient`

## Résultat attendu

Liste exacte des éléments à rendre génériques avant de dessiner le primaire.

## Vérification effectuée (13 juillet 2026)

| Critère | Résultat |
| --- | --- |
| Rapport d'audit présent | ✅ `context/audit-phase-1-bulletins-primaire-secondaire.md` |
| Structure académique complète | ✅ `lib/academic-structure.ts` — primaire (9 périodes) et secondaire (6 périodes) |
| Types de période étendus | ✅ `lib/types/index.ts` — `p5`, `p6`, `exam3`, `sem3` reconnus |
| Maxima par période | ✅ `lib/bulletin-maxima.ts` — neuf clés acceptées |
| Totaux annuels limités à 2 groupes | ✅ Confirmé — `BulletinYearMaxima` : `semester1`, `semester2` uniquement |
| Contexte sans `branchType` | ✅ Confirmé — `lib/bulletin-context.ts` (phase 2 requise) |
| Layouts PDF séparés | ❌ Absents — `bulletin-primary-layout.ts` / `bulletin-secondary-layout.ts` inexistants |
| PDF limité à 2 groupes | ✅ Confirmé — `useBulletinPDF.tsx` et `bulletins.tsx` collectent `sem3` mais ne le dessinent pas |
| Largeurs codées en dur | ✅ Documentées — `colRatios`, `semSubRatios`, coordonnées `totX1`/`totX2`, etc. |

## Éléments clés à généraliser (synthèse de l'audit)

| Fichier | Limite identifiée |
| --- | --- |
| `lib/academic-structure.ts` | Source de vérité déjà prête — à brancher sur les calculs et le PDF |
| `lib/bulletin-maxima.ts` | Totaux annuels ignorant le 3ᵉ trimestre |
| `lib/types/index.ts` | `TotalKey`, `ApplicationType`, `getPlaceValue`, `drawMatiere` limités à 2 groupes |
| `ClassFicheClient.tsx` | `periodMap`, totaux `TT1`/`TT2`, champs généraux sans 3ᵉ groupe |
| `useBulletinPDF.tsx` / `bulletins.tsx` | Rendu explicite 2 semestres, largeurs fixes |
| `lib/bulletin-context.ts` | Pas de transmission du type de branche |

## Risques confirmés

- `p5`, `p6`, `exam3` collectés puis omis silencieusement dans le PDF
- Total général primaire incomplet (3ᵉ groupe non additionné)
- Place et appréciations du 3ᵉ trimestre rangées dans le 2ᵉ semestre
- Chevauchements A4 si colonnes ajoutées sans refonte des largeurs
- Divergence si les deux générateurs PDF sont modifiés séparément

## Prochaine étape

→ [unit-phase-02.md](./unit-phase-02.md) — Ajouter le type de branche au contexte du bulletin
