# Contexte — Rapports organisation (multi-branches + analytics)

> Document de plan produit / technique.  
> Objectif : permettre au **propriétaire** et au **gestionnaire** (et rôles managers org) de consulter **tous les rapports** de leur organisation, avec filtre **une branche** ou **toutes les branches**, via des graphiques dynamiques (shadcn Chart + Recharts) et exports Excel/PDF.  
> Route cible : `/admin/organizations/[organizationId]/rapport`  
> Statut : **phases 0–7 livrées (MVP étendu)** — juillet 2026.

---

## 1. État actuel

| Élément | Situation |
|--------|-----------|
| Page org | `/admin/organizations/[organizationId]/rapport` + carte « Rapports et statistiques » sur l’accueil org |
| Auth | `enforceOrganizationManagerPage` → owner, gestionnaire, préfet, directeur, superviseur (+ platform owner/admin) |
| Filtre branche | `?branchId=` — **toujours une branche** (défaut = première) ; **pas de mode « toutes »** |
| Données MVP | Effectifs élèves, sexe, statut, présence élèves (pie), paiements vs dépenses par mois |
| Charts | Recharts brut dans `rapport-dashboard.tsx` — **pas encore** `@shadcn/chart` |
| Exports | Excel (`xlsx`) + PDF effectifs (`jspdf` + `lib/reports/`) |
| Manquant | Satisfaction parents, présence enseignant/personnel, budget/impayés, effectifs actifs/inactifs multi-entités, résultats scolaires, candidatures, inscriptions publiques, comparaison inter-branches |

### Fichiers existants à étendre

| Zone | Chemin |
|------|--------|
| Page | `app/admin/organizations/[organizationId]/rapport/page.tsx` |
| Action | `…/rapport/rapport.action.ts` (`getOrganizationReportData`) |
| UI | `…/rapport/rapport-dashboard.tsx` |
| PDF | `…/rapport/export-rapport-effectifs-pdf.ts` |
| Branding PDF | `lib/reports/*` |
| Stats branche (réutiliser formules) | `…/[branchId]/admin-stats.ts` |
| Présences rapports | `…/attendance/*report*` |
| Caisse | `…/paiement/components/CashierReport.tsx`, `UnpaidReport.tsx` |
| Résultats | `…/results/` |
| Candidatures | `…/candidatures/` |

---

## 2. Objectifs produit

1. **Vue organisation** : un hub Rapports pour toute l’org, pas seulement une branche.
2. **Sélecteur de portée** : branche unique **ou** « Toutes les branches » (+ comparaison côte à côte).
3. **Filtres temporels** : année scolaire (une / toutes), période (mois, trimestre, plage dates).
4. **Rapports métier complets** (listés §4) avec **KPI cards + graphiques dynamiques + tableau détail**.
5. **Exports** Excel / PDF par rapport (et pack « tout l’org »).
6. **Performance** : agrégats Prisma (`groupBy` / SQL) — ne plus charger tous les élèves en mémoire.
7. **Accès** : propriétaire + gestionnaire (et managers org déjà autorisés) ; pas caissier / teacher / parent.

---

## 3. Décisions produit — figées

### 3.1 Accès

| Règle | Comportement |
|-------|----------------|
| Qui voit `/rapport` | Même gate que aujourd’hui : `enforceOrganizationManagerPage` (owner, gestionnaire, préfet, directeur, superviseur + platform). |
| Permission fine (optionnel V2) | Ajouter ressource `report:read` dans `lib/permissions.ts` — **hors MVP** si le gate actuel suffit. |
| Isolation | Toutes les queries filtrées par `organizationId` ; jamais de fuite cross-org. |

### 3.2 Portée géographique

| Mode | Comportement |
|------|----------------|
| `branchId=<id>` | Agrégats d’une seule branche. |
| `branchId=all` (ou absence + flag `scope=all`) | Agrégats **toutes branches actives** de l’org. |
| Comparaison | Série « par branche » (barres groupées / stacked) sur les KPIs clés. |

### 3.3 Portée temporelle

| Filtre | Comportement |
|--------|----------------|
| `schoolYearId` | Une année, ou `all` = toutes les années disponibles de l’org. |
| Plage dates | Pour présence / finance / candidatures (optionnel par onglet). |
| Année courante | Défaut = `SchoolYear.isCurrentYear` si présent sur au moins une branche ; sinon dernière année. |

### 3.4 UX hub

| Élément | Comportement |
|---------|----------------|
| Navigation | Hub avec **onglets / sections** (Effectifs, Présences, Finance, Satisfaction, Résultats, RH/Candidatures, Inscriptions, Vue d’ensemble). |
| Deep-link | Query params : `?scope=all\|branch&branchId=&schoolYearId=&tab=` |
| Empty states | Message clair si aucune branche / aucune donnée pour le filtre. |
| Loading | Skeletons par section ; fetch parallèle par onglet (lazy) pour ne pas bloquer tout le hub. |

---

## 4. Catalogue des rapports

### 4.1 Demandés (obligatoires)

#### A. Satisfaction parents

| Item | Détail |
|------|--------|
| Source | `ParentFeedback` (`rating`, `month`, `schoolYearId`, `branchId`) |
| KPIs | Note moyenne, % positifs (rating ≥ 4), taux de réponse (feedbacks / parents), tendance mois |
| Dimensions | Branche, mois, année scolaire |
| Charts shadcn | **Area interactive** (évolution note), **Radar** (dimensions si commentaires thématisés plus tard), **Bar** (répartition 1–5) |
| Réutiliser | Formules `admin-stats.ts` (rating ≥ 4) |

#### B. Présences — élèves, personnel, enseignants

| Item | Détail |
|------|--------|
| Sources | `StudentAttendance`, `TeacherAttendance`, `PersonnelAttendance` (+ sessions) |
| KPIs | Taux présence / absence / retard / excusé ; absences chroniques (seuil) |
| Dimensions | Branche, classe (élèves), période, jour de semaine, heure |
| Charts | **Pie/Donut** répartition statuts ; **Bar stacked** par mois ; **Line** tendance ; heatmap jour×heure (optionnel) |
| Réutiliser | Patterns `attendance/*report*` + exports PDF branche |

#### C. Paiements / budget

| Item | Détail |
|------|--------|
| Sources | `FamilyPayment`, `Invoice`, `CashierExpense`, `CashierOpeningBalance`, `Frais` / `TypeFrais`, `ExchangeRate` (org) |
| KPIs | **Budget annuel attendu** (somme frais / factures), **récolté** (paiements `VALIDE`), **reste** (impayés `UNPAID` + `PARTIAL`), dépenses, solde caisse |
| Dimensions | Branche, mois, type de frais, méthode de paiement, statut |
| Charts | **Area** encaissements vs dépenses ; **Bar stacked** budget / récolté / reste ; **Pie** méthodes ; gauge/radial **taux de recouvrement** |
| Réutiliser | `CashierReport`, `UnpaidReport` |

#### D. Effectifs — élèves, parents, enseignants, personnel

| Item | Détail |
|------|--------|
| Sources | `Student`, `Parent`, `Teacher`, `Personnel` via `BranchMember` + `User.sexe` + flags actifs |
| KPIs | Total ; **actifs / inactifs** ; **par sexe** ; **par classe** (élèves) ; par branche |
| Dimensions | Année scolaire **ou toutes** ; branche **ou toutes** |
| Charts | **Bar** totaux par branche ; **Pie** sexe ; **Bar stacked** actif/inactif ; **Bar** par classe |
| Notes | Actif élève ≈ `statusStudent` / enrollment courant ; aligner définitions avec listes branch existantes |

#### E. Résultats scolaires

| Item | Détail |
|------|--------|
| Sources | `StudentGrade`, `fiche` / moyennes branche, `period`, `ClassEnrollment` |
| KPIs | Moyenne générale, taux de réussite, répartition mentions / échecs |
| Dimensions | Classe, année, sexe, branche, période |
| Charts | **Bar** moyennes par classe ; **Box/Bar** par sexe ; **Line** évolution périodes ; ranking top/bottom classes |
| Réutiliser | `results/` + formules succès `admin-stats.ts` |

#### F. Candidatures (embauche)

| Item | Détail |
|------|--------|
| Source | `JobApplication` (`PENDING`, `REVIEWED`, `ACCEPTED`, `REJECTED`, `HIRED`, `CANCELLED`) |
| KPIs | Pipeline ; taux acceptation / rejet / embauche ; délai moyen ; split `TEACHER` vs `PERSONNEL` |
| Dimensions | Branche, type, mois, statut |
| Charts | **Funnel** (bar horizontal étapes) ; **Pie** statuts ; **Bar** embauches par mois |
| Réutiliser | UI `candidatures/` |

---

### 4.2 Rapports complémentaires (oubliés / à forte valeur)

| # | Rapport | Source | Pourquoi |
|---|---------|--------|----------|
| G | **Inscriptions publiques** | `RegistrationRequest` | Funnel demande → confirmé → inscrit / rejeté |
| H | **Impayés détaillés** | `Invoice` | Montant dû, partiel, familles à risque |
| I | **Comparaison inter-branches** | Agrégats multi-branch | Décision propriétaire multi-campus |
| J | **Catégories élèves** | `Student.category` (NORMAL, ORPHAN, VIP…) | Suivi social / tarification |
| K | **Remises** | `DiscountRule` + allocations | Impact budget |
| L | **Mobile Money** | `MobileMoneyTransaction` | Canaux de paiement |
| M | **Activité pédagogique** | Teachings / fiches / schedule | Charge enseignants, couverture cours |
| N | **Événements** | `CalendarEvent` | Volume & participation (si trackée) |
| O | **Attestations / brevets** | modules existants | Volume délivré / an |
| P | **Rétention / flux élèves** | enrollments YoY | Entrées / sorties / redoublements |
| Q | **Absences chroniques** | attendance aggregations | Alerte précoce |
| R | **Vue exécutive (dashboard 1 écran)** | synthèse A–F | Landing du hub |

**Priorité MVP étendu** : A–F + G + H + I + R.  
**V2** : J–Q.

---

## 5. Cartographie charts (shadcn + Recharts)

### 5.1 Stack

| Couche | Choix |
|--------|-------|
| UI Chart | `npx shadcn@latest add @shadcn/chart` → `components/ui/chart.tsx` |
| Moteur | **Recharts** déjà en `^3.8.1` (aligné dépendance shadcn) |
| Blocks de référence | `@shadcn/chart-bar-stacked`, `chart-pie-donut`, `chart-area-interactive`, `chart-radar-default`, `chart-radial-stacked`, `chart-bar-mixed`, `chart-line-dots` |
| Thème | CSS variables du design system (pas de palette violette générique) — réutiliser tokens existants org/branch |

### 5.2 Mapping rapport → type de graphique

| Rapport | Graphiques recommandés |
|---------|------------------------|
| Vue exécutive | KPI cards + small multiples (sparklines area) |
| Effectifs | Bar (branche/classe), Pie (sexe), Stacked (actif/inactif) |
| Présences | Donut statuts, Bar stacked mois, Line tendance |
| Finance | Area interactive encaissements/dépenses, Radial taux recouvrement, Bar budget/récolté/reste |
| Satisfaction | Area note moyenne, Bar distribution ratings |
| Résultats | Bar moyennes classes, Line périodes, Mixed sexe×classe |
| Candidatures | Funnel horizontal, Pie statuts |
| Inscriptions | Funnel + Bar mensuel |
| Comparaison branches | Grouped bar multi-métriques |

### 5.3 Composants partagés à créer

```
components/reports/
  report-filters.tsx          # branche | all, année, dates, tab
  report-kpi-card.tsx
  report-section.tsx          # titre + actions export
  report-empty.tsx
  report-skeleton.tsx
  charts/
    report-area-chart.tsx
    report-bar-chart.tsx
    report-stacked-bar-chart.tsx
    report-donut-chart.tsx
    report-radial-chart.tsx
    report-funnel-chart.tsx
```

Convention : chaque chart accepte `{ data, config: ChartConfig, className }` façon shadcn.

---

## 6. Architecture technique

### 6.1 Routes & params

```
/admin/organizations/[organizationId]/rapport
  ?tab=overview|effectifs|presences|finance|satisfaction|resultats|rh|inscriptions
  &scope=branch|all
  &branchId=<uuid>          # si scope=branch
  &schoolYearId=<id>|all
  &from=&to=                # optionnel ISO dates
```

### 6.2 Couche données

| Module | Rôle |
|--------|------|
| `rapport.action.ts` | Guards + orchestration (garder entrée unique) |
| `lib/reports/org/*` | Queries agrégées pures (testables) |
| `getOrganizationReportOverview` | KPIs synthèse |
| `getEffectifsReport` | Élèves / parents / teachers / personnel |
| `getAttendanceReport` | 3 tracks |
| `getFinanceReport` | Budget / récolté / reste / dépenses |
| `getSatisfactionReport` | ParentFeedback |
| `getResultsReport` | Notes / réussite |
| `getHiringReport` | JobApplication |
| `getRegistrationReport` | RegistrationRequest |

**Règle perf** : `groupBy` / `aggregate` Prisma ; pas de `findMany` de toutes les rows sauf export détail paginé.

### 6.3 Filtre branche « all »

```ts
function branchScope(organizationId: string, scope: "all" | "branch", branchId?: string) {
  if (scope === "branch" && branchId) return { branchId };
  return { branch: { organizationId, isActive: true } };
}
```

Pour comparaison : `groupBy: ["branchId"]` + join noms branches.

### 6.4 Définitions métier (à figer en Phase 0)

| Concept | Proposition |
|---------|-------------|
| Élève actif | enrollment `statusEnrollment === true` sur l’année filtrée (ou `statusStudent`) — **valider avec produit** |
| Parent actif | a ≥ 1 enfant actif dans la portée |
| Enseignant / personnel actif | `BranchMember` non archivé + profil lié non soft-deleted |
| Budget annuel | somme `Invoice.finalAmount` si > 0, sinon **frais actifs × inscriptions** (même logique que rapport impayés) |
| Récolté | `FamilyPayment` status `VALIDE` (devise de base org) |
| Format montants | `formatReportAmount` — ex. `104.500 AOA`, `52.500 CDF`, `1,234.56 USD` (PDF + UI hub) |
| Reste | Budget − payé (factures si présentes, sinon récolté) |
| Satisfaction positive | `rating >= 4` |
| Réussite | moyenne ≥ seuil branch (réutiliser `admin-stats`) |

### 6.5 Exports

| Format | Contenu |
|--------|---------|
| Excel | 1 sheet / section ; filtres en métadonnées |
| PDF | En-tête branding `lib/reports` ; 1 rapport à la fois en MVP ; pack ZIP V2 |

---

## 7. Structure UI cible

```
RapportDashboard
├── ReportFilters (branche | toutes, année, dates)
├── Tabs
│   ├── Overview          → ExecutiveReport
│   ├── Effectifs         → EffectifsReport
│   ├── Présences         → AttendanceReport (sous-tabs élève/enseignant/personnel)
│   ├── Finance           → FinanceReport
│   ├── Satisfaction      → SatisfactionReport
│   ├── Résultats         → ResultsReport
│   ├── RH / Candidatures → HiringReport
│   └── Inscriptions      → RegistrationReport
└── ExportToolbar (Excel / PDF selon tab actif)
```

Chaque `*Report` = Server Component data + Client charts (ou RSC + client islands).

---

## 8. Phases d’exécution

### Phase 0 — Cadrage & fondations — **fait**

- [x] Définitions §6.4 figées (`lib/reports/org/definitions.ts`).
- [x] shadcn chart installé (`components/ui/chart.tsx`).
- [x] Squelette `components/reports/*` + `ReportFilters` (scope all/branch + année).
- [x] Hub tabs + query params `tab`, `scope`, `branchId`, `schoolYearKey`.

### Phase 1 — Effectifs — **fait**
### Phase 2 — Présences 3 tracks — **fait**
### Phase 3 — Finance — **fait**
### Phase 4 — Satisfaction — **fait**
### Phase 5 — Résultats — **fait**
### Phase 6 — RH + Inscriptions — **fait**
### Phase 7 — Overview + comparaison + exports — **fait**

> Note : lazy-load strict par onglet reporté en V2 (payload complet pour Excel unifié). Skeletons dédiés reportés en polish V2.

---

### Phase 8 — V2 (backlog)

- [ ] Permission `report:read`.
- [ ] Catégories élèves, remises, Mobile Money, rétention, absences chroniques.
- [ ] Pack export multi-PDF / scheduled email.
- [ ] Cache Redis / materialized views si volume élevé.
- [ ] Drill-down vers listes branch (élève X, facture Y).

---

## 9. Ordre d’implémentation recommandé (résumé)

```
Phase 0  Fondations shadcn chart + filtres all/branch + tabs
   ↓
Phase 1  Effectifs
   ↓
Phase 2  Présences
   ↓
Phase 3  Finance
   ↓
Phase 4  Satisfaction
   ↓
Phase 5  Résultats
   ↓
Phase 6  Candidatures + Inscriptions
   ↓
Phase 7  Overview + comparaison + polish
   ↓
Phase 8  V2 backlog
```

Durée indicative totale MVP étendu (phases 0–7) : **~8–11 jours** selon disponibilité données et validation des définitions métier.

---

## 10. Critères d’acceptation (MVP étendu)

1. Owner / gestionnaire ouvre `/rapport` et choisit **une branche** ou **toutes**.
2. Filtre année scolaire (une / toutes) appliqué aux onglets concernés.
3. Chaque onglet A–F (+ G inscriptions + H impayés dans Finance) affiche KPIs + ≥ 1 graphique dynamique.
4. Mode « toutes » agrège correctement sans doubler les effectifs.
5. Exports Excel (et PDF où déjà pattern) fonctionnent pour la section active.
6. Aucune donnée d’une autre organisation n’apparaît.
7. Temps de chargement overview acceptable (agrégats, pas full table scan élèves).

---

## 11. Comment tester (après implémentation)

1. Se connecter en **propriétaire** ou **gestionnaire** d’une org multi-branches.
2. Org → **Rapports** → scope **Toutes les branches** → vérifier totaux = somme des branches.
3. Passer une branche → totaux = ceux de la branche uniquement.
4. Parcourir chaque onglet ; changer année scolaire ; vérifier charts + exports.
5. Compte **caissier / teacher** : pas d’accès page rapports org.
6. Org mono-branche : UI cohérente (pas d’erreur « all »).

---

## 12. Hors scope (MVP)

- Rapports temps réel WebSocket
- BI externe (Metabase / Power BI)
- Éditeur de rapports custom drag-and-drop
- Accès teacher/parent à leurs propres stats (portails séparés déjà / futurs)
- Modification des données depuis les rapports (lecture seule)

---

## 13. Références code & MCP

| Ressource | Réf. |
|-----------|------|
| Schema | `prisma/schema.prisma` — `ParentFeedback`, `*Attendance`, `FamilyPayment`, `Invoice`, `StudentGrade`, `JobApplication`, `RegistrationRequest` |
| Permissions | `lib/permissions.ts`, `enforceOrganizationManagerPage` |
| shadcn chart | MCP `user-shadcn` → `npx shadcn@latest add @shadcn/chart` + blocks chart-* |
| Patterns charts existants | `rapport-dashboard.tsx`, `attendance/component/attendance-*.tsx` |
