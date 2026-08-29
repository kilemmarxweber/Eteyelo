# Plan multi-cycles — Visibilité par cycle, caisse/inscription partagées, horaires auto

> Objectif : dans un établissement multi-cycles (Maternelle / Primaire / Secondaire), chaque agent ne voit que les données de **son/ses cycle(s)** ; **caisse** et **inscriptions** restent **uniques** pour toute la branche ; l’affectation enseignant saisit les **heures/semaine** pour **régénérer** l’emploi du temps selon le créneau ; un **même cours** peut servir plusieurs cycles sans duplication ; un **enseignant** peut enseigner dans **plusieurs branches** de l’organisation, sans jamais être placé **à la même heure** sur deux branches.

**Statut :** exécution en cours (fondation livrée)  
**Date :** 2026-08-28 (rev. exécution démarrée)

### Progression

| Phase | Statut |
|-------|--------|
| 0 Cadrage | ✅ figé dans le code (`CYCLE_GLOBAL_ROLES`) |
| 1 BranchMemberCycle + création teacher/personnel | ✅ schéma + UI + assign |
| 2 Cours multi-cycles sans duplication | ⏳ (déjà via pondération/classe — pas de `cycle` unique sur Cours) |
| 3 ACL listes / annuaire users | ✅ owner+gestionnaire voient tout ; autres = même cycle (caissier = branche) |
| 4 Caisse / inscription uniques | ✅ déjà le cas (à ne pas cloisonner) |
| 5 weeklyHours Teaching | ✅ champ + formulaire affectation |
| 5b Conflits multi-branches | ✅ `assertTeacherFreeAt` branché sur schedule |
| 6 Régénération horaire auto | ⏳ à faire |
| 7 UX sélecteur cycle | ⏳ à faire |
| 8 Recette | ⏳ |
**Contexte actuel :** `BranchCycle` + `cycle` sur classes/sections/options/périodes existent ; personnes et ACL sont encore **branch-scoped** ; caisse/inscription déjà partagées ; `Teaching` sans heures/semaine ; `Schedule` manuel ; conflit horaire enseignant **intra-branche seulement** (`schedule.action.ts`) ; création member / teacher / personnel **sans** choix de cycle.

---

## 1. Principes cibles

| Domaine | Portée |
|--------|--------|
| Classes, horaires, enseignants, parents, personnel, présences, notes, devoirs, etc. | **Filtrés / visibles par cycle(s)** de l’agent |
| Catalogue **Cours** | **Un seul** enregistrement par matière (code/nom) dans la branche ; rattaché aux cycles via **pondération** et **affectation** |
| Caisse (paiements, dépenses, soldes) | **Une seule** pour la branche |
| Inscriptions (admin + publique) | **Un seul** flux branche (choix du cycle à l’inscription) |
| Affectation enseignant | `heuresParSemaine` + régénération auto des créneaux |
| Enseignant multi-branches | Même personne (`User`) peut avoir un `Teacher` par branche ; **indisponible** si déjà placé à cette heure ailleurs |
| Création d’utilisateurs (multi-cycle) | Choix de **cycle(s)** obligatoire, sauf rôles transverses |

### Règles de visibilité

1. Un agent peut être affecté à **un ou plusieurs** cycles (`MATERNELLE`, `PRIMAIRE`, `SECONDAIRE`, …).
2. Une classe / une présence / un enseignant « du cycle X » n’apparaît qu’aux agents ayant X (sauf rôles transverses).
3. **Caisse** et **Inscription** : pas de cloisonnement cycle — tous les agents autorisés finance / inscription voient l’ensemble de la branche (avec filtres optionnels d’affichage par cycle).
4. Les IDs restent distincts ; on ne duplique pas la caisse ni le module inscription.

### Création d’utilisateurs : cycle obligatoire (sauf rôles transverses)

Dans une branche **multi-cycle**, à la création / invitation / profil branche :

| Profil | Cycle à la création | Accès |
|--------|---------------------|--------|
| **Propriétaire** (`OWNER`) | Non demandé | **Tous** les cycles |
| **Gestionnaire** (`GESTIONNAIRE`) | Non demandé | **Tous** les cycles |
| **Agent de bureau** (`AGENT_BUREAU`) | Non demandé | **Tous** les cycles (comme gestionnaire, **sans finance ni notes**) |
| **Caissier** (`CAISSIER`) | Non demandé | **Tous** les cycles (caisse unique) |
| **Member** (autres rôles org / agents) | **Obligatoire** (≥ 1 cycle) | Uniquement ses cycles |
| **Teacher** | **Obligatoire** (≥ 1 cycle) | Uniquement ses cycles (+ enseignements) |
| **Personnel** | **Obligatoire** (≥ 1 cycle) | Uniquement ses cycles |

**Règles UI / serveur :**

1. Si la branche n’a qu’**un** cycle activé → préremplir / cacher le sélecteur (affectation auto).
2. Si **multi-cycle** → champ cycle(s) visible et **requis** pour member / teacher / personnel.
3. Owner / gestionnaire / caissier : pas de sélecteur ; sync auto de **tous** les `BranchCycle` actifs (ou accès implicite sans lignes — même règle partout).
4. Édition ultérieure : pouvoir ajouter / retirer des cycles (sauf rôles transverses qui restent « partout »).
5. Validation serveur : rejeter création teacher / personnel / member non-transverse sans `BranchMemberCycle` en multi-cycle.

**Surfaces à brancher :**

- `…/members/` (invitation + affectation branche)
- `…/teacher/` (création / import enseignant)
- `…/personnel/` (création / import personnel)
- Éventuel `ensureBranchMemberRoleProfiles` / formulaires d’ajout à la branche

```text
Branche multi-cycle (MAT + PRIM + SEC)
├── Créer caissier     → pas de cycle → accès partout
├── Créer gestionnaire → pas de cycle → accès partout
├── Créer propriétaire → pas de cycle → accès partout
├── Créer enseignant   → choisir cycle(s) * → ACL cycle
├── Créer personnel    → choisir cycle(s) * → ACL cycle
└── Inviter member     → choisir cycle(s) * (sauf si rôle transverse)
```

### Cours : un catalogue, plusieurs cycles (pas de répétition)

**Problème évité :** créer « Mathématiques » une fois pour le primaire et une autre pour le secondaire.

**Règle :**

- `Cours` reste **unique** dans la branche (`codeCours` / `nameCours`).
- Le lien au cycle se fait à :
  - **Pondération** (`CoursOptionPonderation` → `Option.cycle` / niveau) — le cours « apparaît » dans un cycle quand il est pondéré pour une option/classe de ce cycle ;
  - **Affectation** (`Teaching` → `Classe.cycle`) — le cours est donné dans le cycle de la classe affectée.
- **Visibilité agent :** un agent secondaire voit les cours **utilisés** (pondérés ou affectés) dans le secondaire, pas forcément tout le catalogue brut — ou catalogue complet en lecture pour affectation, selon cadrage Phase 0.
- **Ne pas** mettre un seul `cycle` obligatoire sur `Cours` (ça forcerait la duplication). Option possible plus tard : table `CoursCycle` (cours ↔ cycles autorisés) pour restreindre le catalogue à l’affectation sans dupliquer le cours.

```text
Cours "Mathématiques" (1 fois)
   ├── Pondération → Option 7è (SECONDAIRE)
   ├── Pondération → Option 5è primaire (PRIMAIRE)   ← même cours, cycles différents
   └── Teaching → Classe 7A (SECONDAIRE) + weeklyHours
```

### Enseignants : logique métier (mono + multi-branches)

**Identité :**

- Une personne = un `User`.
- Par branche : un `BranchMember` + un `Teacher` (déjà le modèle).
- Un enseignant peut donc avoir des `Teaching` / `Schedule` dans **plusieurs branches** de la même organisation.

**Règle d’or — temps exclusif (partout) :**

> À une plage `(jour, [début, fin))`, un enseignant ne peut être qu’à **un seul endroit** :  
> - **dans la même branche** : pas deux classes / deux salles à la même heure ;  
> - **entre branches** : pas deux établissements à la même heure.  
> Il **peut** enseigner ailleurs **à des heures différentes**.

**État actuel (vérifié dans le code) :**

| Contrainte | Statut | Où |
|------------|--------|-----|
| Même branche : enseignant déjà en cours à cette heure (autre classe) | **Déjà en place** | `assertScheduleSlotAvailable` dans `schedule.action.ts` — refuse avec message explicite |
| Même branche : classe déjà prise à cette heure | **Déjà en place** | idem |
| Même branche : conflit au moment de certains placements teaching | **Partiel** | `teaching.action.ts` (message conflit jour/heure) |
| Multi-branches : même `User` sur deux branches à la même heure | **Absent** | à construire (Phase 5b) |
| Chevauchement de durées (créneaux qui se recouvrent sans même `hour` exact) | **Faible** | aujourd’hui comparaison surtout sur l’égalité d’heure de début |

**Conséquences pour le plan :**

1. **Conserver** et **ne pas régresser** le garde-fou intra-branche.
2. **Renforcer** (Phase 5b / 6) : chevauchement d’intervalles `[start, end)` au lieu de seulement `hour` égal — utile si deux créneaux n’ont pas la même grille.
3. **Étendre** le même helper aux autres branches via `userId` → tous les `Teacher` siblings.
4. Régénération horaire : busy slots = **intra + inter** branches.
5. UI enseignant : créneaux occupés dans la branche + « déjà pris ailleurs ».
6. Présences : restent **par branche**.

```text
# Même branche
Lundi 08:00  Branche A · 6A · Maths     ✅
Lundi 08:00  Branche A · 5B · Physique  ❌ déjà bloqué aujourd’hui (assertScheduleSlotAvailable)

# Autre branche
Lundi 08:00  Branche B · 3è · Physique  ❌ à ajouter (Phase 5b)
Lundi 09:00  Branche B · 3è · Physique  ✅
```

---

## 2. Écarts vs aujourd’hui

| Besoin | État actuel | Travail |
|--------|-------------|---------|
| Agent ↔ cycle(s) | Absent (`BranchMember` sans cycle) | Modèle + UI d’affectation |
| Création member / teacher / personnel | Aucun choix de cycle | Sélecteur obligatoire en multi-cycle |
| Rôles transverses (owner, gestionnaire, caissier) | N/A | Accès tous cycles, sans sélection |
| ACL listes (classes, enseignants, …) | Filtres UI optionnels seulement | Scope serveur obligatoire |
| Cours multi-cycles sans duplication | `Cours` sans cycle ; risque de doublons métier | Lier via pondération / teaching (+ option `CoursCycle`) |
| Caisse unique | Déjà branch-scoped | Documenter + garder hors scope cycle |
| Inscription unique | Déjà branch-scoped | Idem + choix cycle à l’inscription |
| Heures/semaine enseignant | Absent sur `Teaching` | Champ + validation |
| Régénération horaire | Manuelle (`Schedule`) | Moteur d’auto-placement |
| Conflit horaire enseignant **même branche** (2 classes) | **Déjà en place** (`assertScheduleSlotAvailable`) | Conserver + renforcer chevauchement de durée |
| Conflit horaire enseignant **multi-branches** | Absent | Étendre via `userId` → tous les `Teacher` |

---

## 3. Phases d’exécution

### Phase 0 — Cadrage & inventaire (0,5–1 j)

**But :** figer les règles métier avant code.

- [ ] Lister les écrans / actions à **cloisonner** (tout sauf caisse + inscription).
- [ ] **Rôles transverses figés :** `OWNER`, `GESTIONNAIRE`, `CAISSIER` → accès tous cycles, pas de sélecteur à la création.
- [ ] Confirmer qu’aucun autre rôle (ex. directeur d’études) n’est transverse — sinon l’ajouter explicitement.
- [ ] Décider : un parent multi-enfants multi-cycles → visible pour agents des cycles concernés, ou vue « parent » toujours filtrée ?
- [ ] Décider : personnel / enseignant peuvent-ils avoir **plusieurs** cycles à la création (multi-select) ou un seul au départ ?
- [ ] Décider règles conflict horaire (priorité matières, pauses, max heures jour).
- [ ] **Cours :** catalogue filtré par usage cycle (pondération/affectation) vs catalogue complet + filtre à l’affectation.
- [ ] **Enseignant multi-branches :** autoriser explicitement ; conflit = chevauchement de créneau (pas seulement même `hour` exact si durées diffèrent).
- [ ] Politique si régénération branche A casse un horaire déjà stable en branche B → **ne jamais déplacer** les slots d’une autre branche ; seulement éviter / signaler.

**Livrable :** checklist validée (cette section cochée).

---

### Phase 1 — Modèle d’affectation agent → cycle(s) + création users (2–3 j)

**But :** stocker « qui voit quel cycle » et l’exiger à la création (member / teacher / personnel).

**Schéma proposé :**

```prisma
model BranchMemberCycle {
  id             String   @id @default(cuid())
  branchMemberId String
  cycle          Cycle
  branchMember   BranchMember @relation(...)
  createdAt      DateTime @default(now())

  @@unique([branchMemberId, cycle])
  @@index([branchMemberId])
}
```

**Constante rôles transverses (accès partout) :**

```ts
const CYCLE_GLOBAL_ROLES = [
  ORG_ROLE.OWNER,        // propriétaire
  ORG_ROLE.GESTIONNAIRE, // gestionnaire
  ORG_ROLE.CAISSIER,     // caissier
] as const;
// → pas de sélection de cycle ; accès implicite à tous les BranchCycle actifs
```

- [ ] Migration Prisma + backfill :
  - mono-cycle → 1 ligne = cycle de la branche pour tous ;
  - multi-cycle + rôle transverse → tous les cycles (ou accès implicite) ;
  - multi-cycle + teacher / personnel / member non-transverse → à compléter manuellement si manquant (script + UI).
- [ ] Helpers : `getMemberCycles(branchMemberId)`, `isCycleGlobalRole(role)`, `assertCycleAccess(session, cycle)`, `requireCyclesOnCreate(...)`.
- [ ] **Members** (`…/members/`) :
  - invitation / ajout à la branche : multi-select cycle(s) si multi-cycle et rôle non transverse ;
  - masquer le champ pour owner / gestionnaire / caissier.
- [ ] **Teachers** (`…/teacher/`) :
  - formulaire création + import : cycle(s) **requis** en multi-cycle ;
  - persister `BranchMemberCycle` en même temps que `Teacher` / `BranchMember`.
- [ ] **Personnel** (`…/personnel/`) :
  - idem teachers (création + import).
- [ ] Édition profil : modifier les cycles (non-transverse) ; rôles transverses = lecture « Tous les cycles ».
- [ ] Validation serveur sur toutes les actions create/update concernées.

**Hors scope :** ne pas toucher caisse / inscription (déjà accessibles aux rôles transverses finance).

---

### Phase 2 — Cours ↔ cycles via pondération / affectation (sans duplication) (1–2 j)

**But :** connecter les cours aux cycles **à l’usage**, pas en dupliquant le catalogue.

- [ ] **Ne pas** exiger un `cycle` unique sur `Cours`.
- [ ] Pondération : s’assurer que `Option` / niveau portent un `cycle` fiable ; UI pondération filtre options du cycle actif + propose le catalogue cours **unique**.
- [ ] Affectation (`Teaching`) : sélection cours du catalogue branche ; le cycle vient de la **classe** cible.
- [ ] (Optionnel) `CoursCycle` si on veut restreindre « ce cours est autorisé en MATERNELLE + PRIMAIRE » sans forcer deux fiches cours.
- [ ] Visibilité listes cours pour un agent : `cours` liés à une pondération ou un teaching dont le cycle ∈ cycles de l’agent (évite de « voir » un cours jamais utilisé dans son cycle, tout en gardant 1 fiche).
- [ ] Créneaux (`Creneau`) : option `cycle` **ou** lier clairement créneau ↔ classes du cycle (éviter un créneau qui mélange maternelle et secondaire).
- [ ] Vérifier `Section` / `Option` / `Classe` : cycle renseigné à la création.
- [ ] Audit doublons existants (`Math` / `Mathématiques`) : script de fusion douce **hors scope** ou phase ultérieure.

---

### Phase 3 — Scope serveur (ACL) sur les modules cloisonnés (3–5 j)

**But :** « classes du secondaire visibles uniquement aux agents secondaire » — **côté serveur**, pas seulement filtre UI.

Pour chaque module, appliquer `where cycle IN memberCycles` (ou via relation classe) :

| Module | Filtre typique |
|--------|----------------|
| Classes | `classe.cycle` |
| Cours | via pondération / teaching / `CoursCycle` (pas `cours.cycle` unique) |
| Enseignants | cycles dérivés des `Teaching` année en cours **ou** cycles assignés au membre enseignant |
| Personnel | cycles du `BranchMember` |
| Parents | cycles des classes des enfants inscrits année en cours |
| Élèves | classe → cycle |
| Horaires / Schedule | teaching → classe → cycle |
| Présences | session → teaching → cycle |
| Notes / fiches / devoirs | idem |

- [ ] Centraliser dans `lib/auth/cycle-scope.ts` (ex. `cycleWhereForSession(session, branchId)`).
- [ ] Brancher `requireBranchContext` ou wrappers list/get/actions.
- [ ] UI : sélecteur de cycle actif (cookie/session) si l’agent a plusieurs cycles.
- [ ] Tests : agent secondaire ne liste / n’édite pas une classe primaire.

**Exceptions explicites (ne pas filtrer) :**

- `…/paiement/**` (caisse)
- `…/registration/**` + dépôt inscription publique
- éventuels rapports finance consolidés

---

### Phase 4 — Caisse & inscription : confirmer le modèle « unique » (0,5–1 j)

**But :** documenter et verrouiller le comportement déjà souhaité.

- [ ] Audit : aucune route caisse / inscription ne dépend d’un `activeCycle` obligatoire.
- [ ] Inscription : conserver le **choix du cycle / classe** à l’étape élève (déjà partiel via `resolveRequestedCycle`).
- [ ] Caisse : filtres **affichage** par cycle optionnels (rapports), jamais des caisses séparées.
- [ ] Nav : badges « Commun à tous les cycles » sur Caisse & Inscriptions.

---

### Phase 5 — Heures/semaine à l’affectation enseignant (1–2 j)

**But :** saisie métier avant auto-horaire, dans la logique enseignant.

- [ ] Ajouter sur `Teaching` :
  - `weeklyHours Float` = volume en **minutes** / semaine pour cette affectation (ex. 135).
  - Séances = `ceil(weeklyHours / durationCourse)` où `durationCourse` vient de la vacation de la classe (30 min prim/mat, 45 min sec typiquement).
- [ ] Somme des teachings (toutes branches du même `User`, année courante) = **charge globale** affichée à l’affectation.
- [ ] UI affectation (`teaching`) : champ obligatoire « Heures / semaine ».
- [ ] Validation : `weeklyHours > 0` ; cohérent avec `durationCourse` du créneau de la classe.
- [ ] Avertissement si la charge totale (multi-branches) dépasse un plafond configurable (ex. 24 h) — non bloquant en v1, bloquant optionnel.

---

### Phase 5b — Indisponibilités enseignant (même branche + multi-branches) (1–2 j)

**But :** un enseignant ne peut être qu’à **un endroit à la fois** — déjà vrai dans la branche ; à étendre aux autres branches.

**Déjà en production (à conserver) :**

- `assertScheduleSlotAvailable` refuse si le même `teacherId` a déjà un `Schedule` le même jour à la même heure (autre classe de **cette** branche).
- Message : *« Un enseignant ne peut pas donner deux cours à la même heure. »*

**À faire :**

**Helper central :** `lib/teacher-availability.ts`

```ts
// Pseudo-API
getTeacherUserId(teacherId) → userId
listSiblingTeacherIds(userId, organizationId) → Teacher[]
listBusySlots(userId, schoolYearScope) → { branchId, day, startMin, endMin, label }[]
assertTeacherFreeAt({ userId, day, startMin, endMin, excludeScheduleId? })
```

- [ ] Refactor : faire appeler `assertTeacherFreeAt` depuis `assertScheduleSlotAvailable` (couvre **intra** + **inter**).
- [ ] Chevauchement : `[start, start+duration)` vs autres séances (pas seulement égalité d’heure de début).
- [ ] Message clair :
  - même branche → classe / cours déjà pris ;
  - autre branche → `Conflit : déjà en cours à « Branche B » — 3è — Physique le Lundi à 08:00.`
- [ ] UI fiche enseignant / affectation : panneau créneaux occupés (cette branche + autres).
- [ ] Tests :
  - [ ] même branche, 2 classes, même heure → refus (régression du comportement actuel) ;
  - [ ] 2 branches, même heure → refus (nouveau) ;
  - [ ] 2 branches, heures différentes → OK.
- [ ] Lors de l’affectation seule (sans placement) : pas de conflit horaire ; le conflit se joue au **placement** / **régénération**.

**Hors scope pédagogique :** on ne fusionne pas les dossiers enseignant ; chaque branche garde son `Teacher` / présence / notes.

---

### Phase 6 — Moteur de régénération horaire automatique (3–6 j)

**But :** générer / régénérer `Schedule` à partir des heures + créneaux, **en respectant les slots déjà pris ailleurs**.

**Entrées :**

- Créneau(x) des classes concernées (`startTime`, `endTime`, `durationCourse`, récréation).
- Affectations `Teaching` + `weeklyHours`.
- Contraintes :
  - pas de double booking **classe** ;
  - pas de double booking **enseignant dans la branche** ;
  - pas de double booking **enseignant dans une autre branche** (Phase 5b) ;
  - jours ouvrés ; jours fermés (`closesAttendance`).

**Sorties :**

- Lignes `Schedule` (day + hour + teachingId).
- Rapport : placé / non placé / conflits (y compris « indisponible : autre branche »).

**Algorithme (v1 — glouton) :**

1. Charger les **busy slots** de chaque enseignant concerné (toutes branches).
2. Découper la semaine en slots disponibles par classe (grille créneau − récréation − busy enseignant).
3. Ordonner les teachings par priorité (titulaire, plus d’heures, moins de slots libres).
4. Placer `ceil(weeklyMinutes / durationCourse)` séances, **réparties** (1/jour puis 2ᵉ passe…) — ex. 135 min ÷ 45 min → Lun/Mar/Mer.
5. Mode **régénérer** : ne touche **que** les `Schedule` `source: AUTO` de **cette** branche/cycle/année ; **jamais** les horaires d’une autre branche.

**Schéma complémentaire :**

```prisma
// Sur Schedule
source ScheduleSource @default(MANUAL) // MANUAL | AUTO
```

- [ ] Action `regenerateScheduleAction({ branchId, cycle?, schoolYearId, mode })`.
- [ ] UI Horaires : bouton « Régénérer selon les heures ».
- [ ] Preview avant apply + journal des échecs (dont conflits inter-branches).
- [ ] Présences / alertes restent branchées sur `Schedule` → après regen, elles suivent le nouvel horaire **local**.

**v2 (plus tard) :** préférences jours, équilibrage matin/après-midi, coordination multi-branches (proposer des heures libres communes).

---

### Phase 7 — UX multi-cycle & bascule de contexte (1–2 j)

- [ ] Sélecteur de cycle dans le shell branche (si >1 cycle pour l’agent).
- [ ] Persistance : cookie / `Member.activeCycle` / session Better Auth.
- [ ] Empty states : « Aucune classe dans ce cycle » vs « Vous n’êtes pas affecté à ce cycle ».
- [ ] Dashboard stats scopées au cycle actif (sauf widgets caisse).
- [ ] Indicateur enseignant « multi-établissements » si `Teacher` siblings existent.

---

### Phase 8 — Recette & migration données (1–2 j)

- [ ] Script backfill cycles manquants (classes / options).
- [ ] Script backfill `BranchMemberCycle`.
- [ ] Jeu de tests : 3 agents (mat/prim/sec) + owner + caissier.
- [ ] **Cours :** un seul « Maths » pondéré primaire + secondaire ; listes agents filtrées correctement.
- [ ] **Enseignant multi-branches :** placer Lundi 08:00 en A → refus Lundi 08:00 en B ; acceptation Lundi 09:00 en B.
- [ ] Régénération branche A ne modifie pas les `Schedule` de B.
- [ ] Vérifier présences + alertes après regen horaire.
- [ ] Vérifier qu’un caissier voit tous les paiements multi-cycles.
- [ ] Vérifier inscription publique / admin tous cycles.

---

## 4. Ordre recommandé (dépendances)

```text
Phase 0 (cadrage)
    ↓
Phase 1 (agent → cycles) ──┬──→ Phase 3 (ACL modules)
    ↓                      │
Phase 2 (cours via pondération/affectation, sans duplication) ───┘
    ↓
Phase 4 (verrou caisse/inscription)   ← parallèle possible
    ↓
Phase 5 (heures/semaine)
    ↓
Phase 5b (indisponibilités multi-branches)  ← avant ou en parallèle début Phase 6
    ↓
Phase 6 (régénération horaire + busy slots)
    ↓
Phase 7 (UX sélecteur)
    ↓
Phase 8 (recette)
```

**Chemin critique :** 1 → 3 → 5 → 5b → 6.  
**Parallélisable :** 2 avec 1 ; 4 avec 1–3 ; 5b avec fin de 5 ; 7 après 3.

---

## 5. Estimation globale

| Phase | Effort indicatif |
|-------|------------------|
| 0 | 0,5–1 j |
| 1 | 2–3 j |
| 2 | 1–2 j |
| 3 | 3–5 j |
| 4 | 0,5–1 j |
| 5 | 1–2 j |
| 5b | 1–2 j |
| 6 | 3–6 j |
| 7 | 1–2 j |
| 8 | 1–2 j |
| **Total** | **~14–26 j** |

---

## 6. Risques

| Risque | Mitigation |
|--------|------------|
| Agents sans cycle après migration → listes vides | Backfill + défaut pour rôles transverses ; bloqueur UI à la création |
| Oubli du sélecteur sur teacher/personnel/member | Même composant `CycleSelectField` + validation serveur unique |
| Caissier filtré par cycle par erreur | `CYCLE_GLOBAL_ROLES` exclu du filtre partout |
| Duplication de cours (ancien réflexe) | UX : réutiliser le catalogue ; lier cycle via pondération/classe |
| Filtrer les cours trop strictement | Agent voit les cours **utilisables** (pondérés/autorisés) pour son cycle, pas une 2ᵉ fiche |
| Régénération écrase grilles manuelles | `Schedule.source` + option « préserver MANUAL » |
| Régénération A casse B | Regen **locale** uniquement ; busy slots en lecture seule |
| Conflit raté si durées de cours différentes | Comparer intervalles `[start, end)`, pas seulement l’égalité d’heure |
| Parent / enseignant multi-cycles | Autoriser plusieurs `BranchMemberCycle` |
| Perf scan multi-branches | Index `Teaching(teacherId)` + résolution `userId → Teacher[]` une fois par requête |

---

## 7. Fichiers / zones à toucher (référence)

| Zone | Chemins |
|------|---------|
| Schéma | `prisma/schema.prisma` (`Teaching.weeklyHours`, `Schedule.source`, optionnel `CoursCycle`, `BranchMemberCycle`) |
| Cycles | `lib/cycle.ts`, `lib/persist-branch-cycles.ts` |
| Auth / scope | `lib/auth/*`, nouveau `lib/auth/cycle-scope.ts` |
| Création users | `…/members/`, `…/teacher/`, `…/personnel/` (+ imports) |
| Disponibilité enseignant | nouveau `lib/teacher-availability.ts` |
| Affectations / pondérations | `…/teaching/`, pondérations cours-option |
| Horaires | `…/schedule/schedule.action.ts` (`assertScheduleSlotAvailable`), `…/creneau/` |
| Présences | `lib/attendance-*.ts` (suit déjà `Schedule`) |
| Caisse (ne pas cloisonner) | `…/paiement/` |
| Inscription (ne pas cloisonner) | `…/registration/`, dépôt public |

---

## 8. Critères de done

1. Agent secondaire ne voit **ni** classes **ni** présences du primaire (et inversement) ; les cours visibles sont ceux liés à son cycle via pondération/affectation, **sans** fiches cours dupliquées.
2. **Owner / gestionnaire / caissier** voient tous les cycles **sans** avoir à en choisir un à la création.
3. Création **member / teacher / personnel** en multi-cycle **refuse** l’enregistrement sans cycle(s) ; mono-cycle = auto.
4. Une seule caisse ; une seule inscription ; filtres cycle optionnels seulement.
5. À l’affectation, saisie des heures/semaine ; charge multi-branches visible.
6. Impossible de placer / régénérer un enseignant à **deux endroits** à la même plage : **même branche** (déjà en place, à ne pas casser) **et** autres branches (à ajouter) ; OK à des heures différentes.
7. Bouton régénérer produit un horaire cohérent avec créneaux + charge + busy slots (intra + inter), sans modifier les autres branches.
8. Les alertes de présence suivent le nouvel horaire local (et respectent jours fériés).
9. Tests de non-régression : conflit 2 classes même branche toujours refusé.

---

## 9. Prochaine action

Démarrer par **Phase 0** (rôles transverses figés + multi-select cycles), puis **Phase 1** (`BranchMemberCycle` + formulaires members / teachers / personnel).
