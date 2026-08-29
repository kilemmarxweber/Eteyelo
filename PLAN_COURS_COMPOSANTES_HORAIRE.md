# Plan — Sous-cours d’horaire (visibilité) vs cours bulletin (notes)

> Objectif : pouvoir **découper un cours** (ex. Français) en **plusieurs postes visibles** sur l’**horaire** et dans les **affectations** (écriture, récitation, rédaction…), tout en gardant **un seul cours « Français »** pour la **saisie de notes**, la **fiche de cote** et le **calcul de moyenne** (somme / agrégation des sous-parties → une note / un max / une pondération bulletin).

| **Statut :** exécution V1 démarrée (Option A + N1 + enseignant unique)  
**Date :** 2026-08-29  
**Lié à :** `PLAN_MULTI_CYCLE_SCOPING.md` (weeklyHours, Teaching, Schedule) ; pondération `CoursOptionPonderation` ; fiches `fiche` / notes

### Progression V1

| Phase | Statut |
|-------|--------|
| 1 Schéma + helpers | ✅ |
| 2 CRUD postes catalogue | ✅ |
| 3 Filtre pondération parents | ✅ |
| 4 Affectation expand + sync enseignant | ✅ (UI groupée basique via données parent) |
| 5 Libellés horaire | ✅ |
| 6–8 Présences / N2 / recette | ⏳ |
---

## 0. Problème métier (exemple)

Aujourd’hui un `Cours` = une ligne catalogue (`nameCours`, `codeCours`) → une `Teaching` (classe × année × cours) → des créneaux `Schedule` + des `fiche` de notes.

**Besoin :**

| Surface | Affichage attendu |
|--------|-------------------|
| Emploi du temps | Lun 8h **Écriture**, Mar 9h **Récitation**, Jeu 10h **Rédaction** |
| Affectation | Détails : Écriture (45 min), Récitation (45 min), Rédaction (45 min) — **même enseignant** que le cours parent |
| Notes / fiche / bulletin | **Un seul** cours **Français** ; pas de lignes Écriture / Récitation / Rédaction |
| Moyenne | Calculée sur **Français** (pondération bulletin du parent), pas sur chaque détail |

**Contraintes figées :**

1. Ne pas casser le modèle actuel pour les cours « simples » (sans sous-parties).
2. **Un seul enseignant pour le cours parent** : tous les postes d’horaire d’un même parent (ex. Écriture / Récitation / Rédaction sous Français) sont affectés au **même** enseignant ; pas d’enseignants différents par poste au V1.

---

## 1. Vocabulaire proposé (à valider)

| Terme | Signification |
|-------|----------------|
| **Cours bulletin** (`Cours` parent) | Matière officielle : *Français*, *Mathématiques* — unique pour notes, pondération, bulletin |
| **Poste horaire** / **sous-cours** | Étiquette de visibilité horaire / affectation : *Écriture*, *Récitation*, *Rédaction* |
| **Groupe de postes** | Ensemble des postes rattachés à un même cours bulletin |
| **Agrégation notes** | Règle qui transforme les saisies liées aux postes → une note / un max pour le parent |

> Alternative de nommage UI : « Composantes d’horaire », « Créneaux nommés », « Sous-matières (horaire seulement) ».

---

## 2. Principes cibles

1. **Une seule vérité catalogue pour le bulletin** : le parent `Cours` porte `codeCours` / `nameCours` / pondération / domaine primaire.
2. **Les postes ne sont pas des matières bulletin** : ils n’apparaissent **pas** dans la liste de saisie des notes ni dans le bulletin (sauf éventuel détail pédagogique optionnel plus tard).
3. **Horaire & affectation** voient les postes (libellé, heures, créneaux) ; **enseignant unique** = celui du parent (propagé à tous les postes du groupe).
4. **Compatibilité** : cours sans postes = comportement actuel (1 Teaching → Schedule + fiches).
5. **Cycle / multi-branches** : même cloisonnement cycle que le parent (pas de nouveau ACL).
6. **Un enseignant / parent** : changer l’enseignant sur le parent (ou sur un poste) met à jour **tous** les postes du groupe pour la classe × année.

---

## 3. Options de modèle de données (à trancher)

### Option A — Postes comme « vrais » `Cours` enfants (recommandée pour démarrer)

```text
Cours « Français » (parent, gradeable = true)
├── Cours « Écriture »   (parentId → Français, gradeable = false, kind = SCHEDULE_COMPONENT)
├── Cours « Récitation » (idem)
└── Cours « Rédaction »  (idem)
```

- **Teaching / Schedule** : une ligne par **poste** (enfant).
- **Pondération / notes / fiche** : uniquement sur le **parent**.
- Champs à ajouter sur `Cours` :
  - `parentCoursId String?` (self-relation)
  - `kind` enum : `SUBJECT` | `SCHEDULE_COMPONENT` (ou booléen `isScheduleComponent`)
  - éventuellement `sortOrder` pour l’UI

**Avantages :** réutilise Teaching / Schedule / conflits enseignants / weeklyHours.  
**Risques :** `@@unique([branchId, nameCours])` et `codeCours` — les enfants doivent avoir des codes distincts (`FR-ECR`, `FR-REC`…) ; filtrer partout les non-`gradeable` dans notes / pondération / bulletin.

**Règle enseignant (V1) :** un seul `teacherId` partagé pour tous les Teachings des postes d’un même parent (classe × année). L’UI n’expose **qu’un** sélecteur enseignant au niveau du groupe « Français » ; les lignes postes n’ont pas de picker enseignant indépendant.

### Option B — Table `CoursScheduleComponent` + Teaching optionnel

```text
Cours Français
└── CoursScheduleComponent[] { label, sortOrder, defaultWeeklyMinutes }
Teaching { coursId = Français, componentId? }  // créneau lié à un poste
```

- Un seul `coursId` bulletin ; le libellé horaire vient du `component`.
- **Avantages :** notes restent naturellement sur le parent ; **un enseignant / parent** est naturel.  
**Risques :** `@@unique([classeId, schoolYearId, coursId])` sur Teaching empêche plusieurs charges/libellés pour le même parent → il faudrait **assouplir l’unicité** (`classeId + schoolYearId + coursId + componentId`) ou permettre plusieurs Teaching par parent **avec le même teacherId**.

### Option C — Uniquement labels sur `Schedule` (trop faible)

`Schedule.label = "Écriture"` sans structure d’affectation.  
**Rejeté** pour ton cas : tu veux les détails aussi en **affectation**, pas seulement sur la grille.

### Proposition de choix

**Option A** pour les postes (libellés + heures + créneaux distincts), **avec contrainte V1** : enseignant **unique** au niveau parent (pas d’enseignants différents par poste).  
**Option B** reste une alternative si on préfère ne pas créer de `Cours` enfants.

> **Décision §9.1 :** **Non** — un poste **n’a pas** d’enseignant différent du parent. Un seul enseignant pour le cours parent et tous ses postes.

---

## 4. Comportement par surface

### 4.1 Catalogue Cours

- Créer / éditer un cours bulletin.
- Section « Postes d’horaire » : ajouter / renommer / ordonner / désactiver des postes.
- Interdire de pondérer un poste ; n’autoriser la pondération que sur le parent.
- Import catalogue : parent + postes liés (mapping explicite).

### 4.2 Pondération

- Liste / édition : **parents seulement** (`kind = SUBJECT` ou `parentCoursId = null`).
- Max période / unités : ceux du **Français**, pas la somme des postes (sauf règle métier contraire — voir §5).

### 4.3 Affectation (`teaching`)

- Afficher le groupe :
  - En-tête **Français** → **un** sélecteur enseignant (cours parent)
  - Sous-lignes : Écriture / Récitation / Rédaction avec `weeklyHours`, consecutiveSlots, preferredDays — **sans** picker enseignant propre
- À la sauvegarde : propager le même `teacherId` à **tous** les Teachings postes du groupe (classe × année).
- Validation serveur : refuser si deux postes du même parent ont des `teacherId` différents.
- Charge horaire affichée = **somme des postes** (et/ou champ indicatif sur le parent en lecture seule).
- Génération auto d’horaire : boucle sur les Teachings **des postes** (pas le parent s’il n’a pas de Teaching) ; conflits enseignant = un seul profil pour tout le groupe.

### 4.4 Emploi du temps

- Cellule affiche le **libellé du poste** (Écriture), éventuellement sous-titre « Français ».
- PDF / export : même règle.
- Conflits enseignant : inchangés (par Teaching / créneau).

### 4.5 Notes / fiches

- Sélecteur de cours : **uniquement les parents gradeable**.
- `fiche.lessonId` → Teaching du **parent** *ou* Teaching « agrégateur » :
  - **Variante N1 (simple)** : une Teaching « fantôme » / réelle sur le parent uniquement pour les fiches ; les postes n’ont pas de fiche.
  - **Variante N2** : fiches saisies au niveau poste en interne, **agrégées à l’affichage** vers le parent (plus complexe, historique plus riche).

**Recommandation initiale : N1** — saisie notes sur **Français** uniquement ; les postes servent horaire + affectation.  
Si plus tard tu veux des notes détaillées (devoir d’écriture vs récitation) → N2 avec agrégation configurable.

### 4.6 Présences liées au cours / séance

- Les `AttendanceSession` suivent déjà le `Teaching` du créneau → restent au **poste** (cohérent avec l’horaire réel).
- Rapports « par matière » bulletin : rattacher au **parent** via `parentCoursId`.

### 4.7 Devoirs en ligne / résultats / bulletins

- Afficher **Français**.
- Domaine primaire (`primaryDomain`) : sur le parent seulement.

---

## 5. Règles d’agrégation notes (si on ouvre N2 plus tard)

À **ne pas implémenter** tant que N1 suffit ; à figer si tu veux des sous-notes.

| Règle | Description | Exemple |
|-------|-------------|---------|
| **SUM** | Somme des points des postes / somme des max | 8+7+9 / 10+10+10 → 24/30 → ramené au max parent |
| **AVG** | Moyenne simple des % postes | (80%+70%+90%)/3 |
| **WEIGHTED** | Poids par poste (écriture 40 %, rédaction 40 %, récitation 20 %) | Config par parent |
| **MANUAL_ONLY** | Ignore les postes ; saisie directe sur parent (N1) | Défaut |

Pour le bulletin RDC, **MANUAL_ONLY (N1)** + pondération existante sur Français est le plus sûr au départ.

---

## 6. Impacts schéma (si Option A)

```prisma
enum CoursKind {
  SUBJECT              // bulletin / notes
  SCHEDULE_COMPONENT   // poste horaire uniquement
}

model Cours {
  // ... champs existants ...
  kind          CoursKind @default(SUBJECT)
  parentCoursId String?
  parentCours   Cours?    @relation("CoursComponents", fields: [parentCoursId], references: [id], onDelete: Cascade)
  components    Cours[]   @relation("CoursComponents")
  sortOrder     Int       @default(0)

  @@index([parentCoursId])
  @@index([branchId, kind])
}
```

**Règles d’intégrité :**

1. `SCHEDULE_COMPONENT` ⇒ `parentCoursId` obligatoire et parent `kind = SUBJECT`.
2. Interdiction de parent d’un parent (1 niveau seulement au V1).
3. `CoursOptionPonderation` : refuser `coursId` de kind COMPONENT.
4. Notes / fiche : refuser Teaching d’un COMPONENT (ou rediriger vers parent).
5. UI catalogue : ne pas proposer un COMPONENT comme « nouveau cours libre » sans parent.
6. **Enseignant unique / parent** : pour une classe × année, tous les Teachings des `SCHEDULE_COMPONENT` d’un même `parentCoursId` partagent le même `teacherId` (assert à create/update/quick-assign).

**Migration données :** tous les cours existants → `SUBJECT`, `parentCoursId = null`.

---

## 7. Impacts code (surfaces)

| Zone | Changement |
|------|------------|
| `prisma/schema` + migration | champs `kind` / `parentCoursId` / `sortOrder` |
| Catalogue cours | UI postes + API create/update composants |
| `lib/course-ponderation*` | filtrer `kind = SUBJECT` |
| `…/teaching/` | affichage groupé parent → postes ; affectation par poste |
| `…/schedule/` | libellé cellule = poste ; régénération sur Teachings postes |
| `…/notes/`, résultats, bulletins | listes = parents seulement |
| Présences / sessions | OK sur poste ; agrégats matière → parent |
| Imports / merge branche | mapper parent + enfants |
| Multi-cycle ACL | hérite du parent |

---

## 8. UX proposée (brouillon)

### Catalogue

1. Cours **Français** → onglet « Postes d’horaire ».
2. Bouton « Ajouter un poste » → nom + code auto (`FR-ECR`) + ordre.
3. Badge « Horaire seul » sur les postes dans les listes admin avancées (cachés ailleurs).

### Affectation

```text
Français                          [Enseignant A] ← unique pour le groupe
  ├─ Écriture      45 min
  ├─ Récitation    45 min
  └─ Rédaction     45 min
```

> Pas de colonne enseignant par poste : A s’applique à Écriture, Récitation et Rédaction.

### Horaire

| Lun | Mar | …
|-----|-----|----
| Écriture *(Français)* | Récitation *(Français)* | …

### Notes

Liste des cours : **Français** seulement → saisie / fiche / moyenne comme aujourd’hui.

---

## 9. Cas limites & questions ouvertes

**Décidé :**

1. **Enseignants différents par poste ?** **Non** — un seul enseignant pour le cours parent ; tous les postes héritent du même.

À répondre avant d’implémenter :

2. **Saisie de notes au niveau poste ?** Non (N1) / Oui avec agrégation (N2) — laquelle (SUM / AVG / WEIGHTED) ?
3. **Le parent a-t-il aussi des créneaux propres** en plus des postes, ou **uniquement** via postes ?
4. **Titulaire de classe** : lié au parent ou à un poste ?
5. **Même libellé de poste** réutilisable pour plusieurs parents (Écriture pour Français et pour Lingala) ou toujours scoped au parent ?
6. **Secondaire vs primaire** : cette découpe est-elle surtout primaire (langues) ou aussi secondaire ?
7. **Fiche de cote déjà saisie** sur d’anciens « faux » cours Écriture séparés : migration manuelle / script de fusion vers Français ?
8. **Code / nom unique** : `@@unique([branchId, nameCours])` — « Écriture » peut exister sous Français et sous autre matière ? (sinon forcer « Français — Écriture »).

---

## 10. Phases d’exécution (après validation du modèle)

| Phase | Contenu | Dépend |
|-------|---------|--------|
| **0** | Trancher Option A/B + N1/N2 + Q1–Q8 | — |
| **1** | Schéma + migration + helpers `isGradeableCours` / `listScheduleComponents` | 0 |
| **2** | UI catalogue : CRUD postes sous un cours | 1 |
| **3** | Filtrer pondération / notes / bulletins → parents only | 1 |
| **4** | Affectation groupée + Teaching sur postes | 2 |
| **5** | Horaire : libellés postes + régénération | 4 |
| **6** | Présences / exports / PDF | 5 |
| **7** | (Optionnel) Agrégation notes N2 | 3 |
| **8** | Recette + migration données legacy | 6 |

---

## 11. Critères de done (V1 = Option A + N1)

1. On peut définir ≥ 2 postes sous **Français** sans créer de matières bulletin parasites.
2. L’affectation montre les détails (heures par poste) et **un seul enseignant** au niveau du parent, propagé à tous les postes.
3. L’horaire affiche Écriture / Récitation / Rédaction (avec rappel Français).
4. La saisie de notes et la fiche ne proposent que **Français** ; la moyenne / pondération portent sur **Français**.
5. Un cours sans postes se comporte exactement comme aujourd’hui.
6. Pas de régression conflits enseignants / weeklyHours / multi-cycle.
7. Impossible d’affecter deux enseignants différents à deux postes du même parent (UI + assert serveur).

---

## 12. Prochaine action

1. Lire ce plan et **répondre aux questions §9 restantes** (surtout 2, 3, 8) — la Q1 enseignant est **tranchée**.
2. Trancher **Option A vs B** et **N1 vs N2**.
3. Ensuite on fige une mini-spec (schéma + 3 mockups : catalogue, affectation, horaire) avant le code.

---

## 13. Notes d’implémentation (rappels code actuel)

- `Cours` : `@@unique([branchId, codeCours])`, `@@unique([branchId, nameCours])` — attention aux noms de postes.
- `Teaching` : `@@unique([classeId, schoolYearId, coursId])` — un Teaching par cours (poste) et par classe/année.
- `fiche.lessonId` → `Teaching` ; `coursName` dénormalisé à la création.
- Pondération : `CoursOptionPonderation` liée au `coursId` — doit rester sur le parent.
- Régénération horaire : basée sur `weeklyHours` des Teachings — cibler les Teachings des postes.
- Enseignant unique / parent : helper du type `assertSameTeacherForParentComponents({ parentCoursId, classeId, schoolYearId, teacherId })` sur create/update/quick-assign.
