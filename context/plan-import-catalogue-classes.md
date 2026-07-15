# Plan — Import catalogue des classes (PRIMAIRE / SECONDAIRE)

> **Statut :** exécuté (nomenclature CTEB/Humanités + import + formulaires publics)  
> **Objectif :** bouton « Importer catalogue » sur la page Classes, qui crée uniquement les classes adaptées au `typebranch` de la branche courante.

---

## 0. Référentiel officiel du pays (source)

Structure secondaire / humanités retenue :

| Niveau | Classe | Section | Option |
|--------|--------|---------|--------|
| **Éducation de Base** | 7ᵉ année | Éducation de Base (CTEB) | Tronc commun |
| **Éducation de Base** | 8ᵉ année | Éducation de Base (CTEB) | Tronc commun |
| **Humanités** | 1ʳᵉ Humanités *(anciennement 3ᵉ secondaire)* | Selon la filière choisie | Selon l'option |
| **Humanités** | 2ᵉ Humanités *(anciennement 4ᵉ secondaire)* | Selon la filière choisie | Selon l'option |
| **Humanités** | 3ᵉ Humanités *(anciennement 5ᵉ secondaire)* | Selon la filière choisie | Selon l'option |
| **Humanités** | 4ᵉ Humanités *(anciennement 6ᵉ secondaire)* | Selon la filière choisie | Selon l'option |

**Règles dérivées :**

1. `7è` / `8è` → **toujours** section `Éducation de Base (CTEB)` + option `Tronc commun`.
2. `1ʳᵉ`–`4ᵉ` Humanités → **obligatoirement** une section (filière) **et** une option de cette filière.
3. Les anciennes appellations « 3ᵉ–6ᵉ secondaire » ne sont plus utilisées comme `level` ; on stocke `1è-HUM` … `4è-HUM` (voir §3).

Le **primaire** (hors tableau officiel ci-dessus) reste : `1è-PR` → `6è-PR`, sans section/option visibles.

---

## 1. Besoin

| Branche | Ce que l’import doit créer |
|---------|----------------------------|
| **PRIMAIRE** | Classes `1è-PR` → `6è-PR` uniquement (pas de section / option visibles) |
| **SECONDAIRE** | (1) `7è` + `8è` liées à **CTEB / Tronc commun** ; (2) `1ʳᵉ`–`4ᵉ` Humanités liées à chaque **section (filière) + option** active |

Modèle de référence (cours primaire) :

- catalogue statique → sync idempotent → action serveur → bouton UI  
- `lib/primary-domains.ts`, `lib/primary-catalog-sync.ts`

Même pattern pour les classes.

---

## 2. État actuel (constat)

| Élément | État |
|---------|------|
| Création manuelle classe | OK (`classe-form`, `classe.action`, `lib/class-structure.ts`) |
| Catalogue cours primaire | OK |
| Catalogue **classes** | ❌ inexistant |
| Seed `initClasses.ts` | Legacy (7e/8e, 5e/6e), sans `level` structuré, « Cycle d’orientation » obsolète |
| Levels code **actuel** | PRIMAIRE `1er`–`6e` ; SECONDAIRE `1er`–`6e` + option |
| **Cible (ce plan)** | PRIMAIRE `1è-PR`–`6è-PR` ; SECONDAIRE = CTEB `7è`/`8è` + Humanités `1è`–`4è` avec **section + option** |

> Phase 0 : aligner `lib/class-structure.ts` + formulaire sur ce référentiel **avant** l’import.

---

## 3. Décisions figées

### D1 — Niveaux et nomenclature — **retenue (plan pays)**

| Cycle | `level` | Section | Option | Ex. `nameClasse` | Ex. `codeClasse` |
|-------|---------|---------|--------|------------------|------------------|
| Primaire | `1è` … `6è` | — (interne PRIMAIRE) | — | `1è-PR` | `1è-PR` |
| Éducation de Base | `7è` | Éducation de Base (CTEB) | Tronc commun | `7è Tronc commun` | `7è-TC` |
| Éducation de Base | `8è` | Éducation de Base (CTEB) | Tronc commun | `8è Tronc commun` | `8è-TC` |
| Humanités | `1è` | Filière (ex. Scientifique) | Option (ex. Biologie-Chimie) | `1è Biologie-Chimie` | `1è-BIO` |
| Humanités | `2è` | Filière | Option | `2è Biologie-Chimie` | `2è-BIO` |
| Humanités | `3è` | Filière | Option | `3è Biologie-Chimie` | `3è-BIO` |
| Humanités | `4è` | Filière | Option | `4è Biologie-Chimie` | `4è-BIO` |

**Correspondance historique (doc / UI aide) :**

| Level Humanités | Ancien libellé |
|-----------------|----------------|
| `1è` | 3ᵉ secondaire |
| `2è` | 4ᵉ secondaire |
| `3è` | 5ᵉ secondaire |
| `4è` | 6ᵉ secondaire |

**Abréviations option (codes classe) :**

| Option | Abrév. |
|--------|--------|
| Tronc commun | `TC` |
| Biologie-Chimie | `BIO` |
| Mathématiques - Physique | `MAT` |
| Latin - Philosophie | `LAT` |
| Philosophie - Lettres | `LET` |
| Commerciale et gestion | `COM` |
| … | (catalogue complet §4.3) |

Relation Prisma à respecter :

```
Section (filière / CTEB)
  └── Option (Tronc commun | Biologie-Chimie | …)
        └── Classe (level + optionId)
```

> Une classe secondaire **porte toujours** un `optionId` ; la section est lue via `Option.sectionId` (pas de FK section directe sur `Classe`).

### D2 — Parallèles — **A (retenue)**

Créer **1 classe par niveau** (sans `A`/`B`). L’école ajoute les parallèles manuellement ensuite.

### D3 — Sections / options — **à confirmer**

| Option | Comportement |
|--------|--------------|
| **A** | Upsert **toutes** les sections + options du catalogue, puis les classes |
| **B (défaut proposé)** | Classes pour les **options déjà créées** + **toujours** garantir CTEB / Tronc commun pour `7è`/`8è` |
| **C** | A + case à cocher « Importer aussi sections/options RDC » |

### D4 — UI — **A (retenue)**

Bouton sur la page **Classes**.

### D5 — Idempotence

- pas de doublon `(branchId, nameClasse)` / `(branchId, codeClasse)` ;
- pas de suppression des classes existantes ;
- résumé `{ created, skipped, updated? }`.

---

## 4. Contenu du catalogue

### 4.1 PRIMAIRE

Pas de section / option dans l’UX.  
FK interne : `ensurePrimaryAcademicStructure()`.

| level | nameClasse | codeClasse |
|-------|------------|------------|
| `1è` | `1è-PR` | `1è-PR` |
| `2è` | `2è-PR` | `2è-PR` |
| `3è` | `3è-PR` | `3è-PR` |
| `4è` | `4è-PR` | `4è-PR` |
| `5è` | `5è-PR` | `5è-PR` |
| `6è` | `6è-PR` | `6è-PR` |

### 4.2 SECONDAIRE — Sections (filières + CTEB)

| codeSection | nameSection | Rôle |
|-------------|-------------|------|
| `CTEB` | Éducation de Base (CTEB) | Cycle 7ᵉ / 8ᵉ uniquement |
| `SCIE` | Scientifique | Filière Humanités |
| `LITT` | Littéraire | Filière Humanités |
| `COMM-AD` | Commerciale et administrative | Filière Humanités |
| `TECH` | Techniques | Filière Humanités |
| `PEDA` | Pédagogiques | Filière Humanités |
| `HUM-GEN` | Humanités générales | *(legacy seed — à migrer / ne plus utiliser pour 7è–8è)* |

> **Changement vs ancien plan :** plus de « Cycle d’orientation » sous Humanités générales pour `7è`/`8è`. Remplacé par **CTEB + Tronc commun**.

### 4.3 SECONDAIRE — Options (liées aux sections)

| codeOption | nameOption | section | abrév. | Utilisé pour |
|------------|------------|---------|--------|--------------|
| `TRONC-COM` | Tronc commun | `CTEB` | `TC` | `7è`, `8è` uniquement |
| `BIO-CHI` | Biologie-Chimie | `SCIE` | `BIO` | `1è`–`4è` Humanités |
| `MATH-PHYS` | Mathématiques - Physique | `SCIE` | `MAT` | `1è`–`4è` |
| `LATIN-PHILO` | Latin - Philosophie | `LITT` | `LAT` | `1è`–`4è` |
| `LETT-PHIL` | Philosophie - Lettres | `LITT` | `LET` | `1è`–`4è` |
| `COMM-GEST` | Commerciale et gestion | `COMM-AD` | `COM` | `1è`–`4è` |
| `COMM-SEC-ADM` | Secrétariat administratif | `COMM-AD` | `SEC` | `1è`–`4è` |
| `COMM-COMPTE` | Comptabilité | `COMM-AD` | `CPT` | `1è`–`4è` |
| `TECH-ELEC-GEN` | Électricité générale | `TECH` | `ELE` | `1è`–`4è` |
| `TECH-MECA` | Mécanique générale | `TECH` | `MEC` | `1è`–`4è` |
| `TECH-CONSTR` | Technique construction | `TECH` | `CST` | `1è`–`4è` |
| `TECH-ELEC` | Électronique | `TECH` | `ELN` | `1è`–`4è` |
| `INFO-GEST` | Informatique de gestion | `TECH` | `INF` | `1è`–`4è` |
| `PED-GEN` | Pédagogie générale | `PEDA` | `PDG` | `1è`–`4è` |
| `PED-SCIE` | Pédagogie des sciences | `PEDA` | `PDS` | `1è`–`4è` |
| `PED-LAN` | Pédagogie des langues | `PEDA` | `PDL` | `1è`–`4è` |

> Ancienne option `CYC-ORIEN` / « Cycle d'orientation » : **obsolète** pour ce plan. Remplacée par `TRONC-COM`.

### 4.4 SECONDAIRE — Classes générées

#### A. Éducation de Base (CTEB)

| Niveau pays | level | Section | Option | nameClasse | codeClasse |
|-------------|-------|---------|--------|------------|------------|
| 7ᵉ année | `7è` | Éducation de Base (CTEB) | Tronc commun | `7è Tronc commun` | `7è-TC` |
| 8ᵉ année | `8è` | Éducation de Base (CTEB) | Tronc commun | `8è Tronc commun` | `8è-TC` |

#### B. Humanités (selon filière + option)

Pour **chaque option active** hors `TRONC-COM` :

| Niveau pays | level | Section | Option | nameClasse (ex.) | codeClasse (ex.) |
|-------------|-------|---------|--------|------------------|------------------|
| 1ʳᵉ Humanités | `1è` | Scientifique | Biologie-Chimie | `1è Biologie-Chimie` | `1è-BIO` |
| 2ᵉ Humanités | `2è` | Scientifique | Biologie-Chimie | `2è Biologie-Chimie` | `2è-BIO` |
| 3ᵉ Humanités | `3è` | Scientifique | Biologie-Chimie | `3è Biologie-Chimie` | `3è-BIO` |
| 4ᵉ Humanités | `4è` | Scientifique | Biologie-Chimie | `4è Biologie-Chimie` | `4è-BIO` |

Même matrice pour chaque autre option (MAT, LAT, COM, …).

**Règle D3=B :**  
- toujours créer / garantir `7è-TC` + `8è-TC` ;  
- pour Humanités, ne créer `1è`–`4è` que pour les options **déjà** présentes dans la branche.

---

## 5. Architecture cible

```
lib/class-catalog.ts              ← CTEB + filières + options + abrév.
lib/class-catalog-sync.ts         ← upsert Section → Option → Classe
classe/classe.action.ts           ← importClassCatalogAction()
classe/ClassesClient              ← bouton « Importer catalogue »
```

### Flux sync

```
1. Lire Branch.typebranch
2. PRIMAIRE :
     ensurePrimaryAcademicStructure()
     upsert 1è-PR … 6è-PR
3. SECONDAIRE :
     a. Upsert Section CTEB + Option Tronc commun
     b. (si D3=A/C) upsert autres sections/options catalogue
     c. Upsert classes 7è-TC, 8è-TC
     d. Pour chaque option active ≠ TRONC-COM :
          upsert 1è / 2è / 3è / 4è × option (section via Option.sectionId)
4. Résumé + revalidatePath Classes
```

### Matching

1. `codeClasse` (`7è-TC`, `1è-BIO`, `1è-PR`, …)  
2. sinon `nameClasse`  
3. sinon créer  
4. ne pas écraser `capacity` / `creneauId`

### Sécurité

- `requireBranchContext()` + permission manage  
- PRIMAIRE : pas de section/option visibles  
- SECONDAIRE : `optionId` de la même branche ; section cohérente via l’option  
- `7è`/`8è` : refuser toute option autre que Tronc commun (CTEB)  
- Humanités `1è`–`4è` : refuser Tronc commun / CTEB  

### Impact `class-structure.ts`

- PRIMAIRE : niveaux / codes `1è-PR` … `6è-PR`  
- SECONDAIRE sans option libre : `7è`, `8è` **mais** option CTEB Tronc commun obligatoire  
- SECONDAIRE Humanités : `1è`–`4è` + option de filière obligatoire  
- `buildClassCode` : `{level}-{ABREV}`  
- Labels UI : « 1ʳᵉ Humanités (anc. 3ᵉ sec.) », etc.

---

## 6. Phases d’exécution

| # | Phase | Livrables |
|---|-------|-----------|
| **0** | Alignement nomenclature + règles CTEB/Humanités | `class-structure.ts`, formulaire |
| **1** | Catalogue | `lib/class-catalog.ts` |
| **2** | Sync | `lib/class-catalog-sync.ts` |
| **3** | Action | `importClassCatalogAction` |
| **4** | UI | Bouton page Classes |
| **5** | Seed (opt.) | `seed:class-catalog` |
| **6** | Tests | PRIMAIRE + CTEB + Humanités |

---

## 7. UX (page Classes)

```
[ Créer une classe ]   [ Importer catalogue ]
```

Confirmation :

- **PRIMAIRE** : « Créer 1è-PR … 6è-PR manquantes »  
- **SECONDAIRE** : « Créer 7è/8è (CTEB — Tronc commun) + 1ʳᵉ–4ᵉ Humanités pour les options / filières actives »

Toast : `N créées, M déjà présentes`.

---

## 8. Hors scope (v1)

- Parallèles auto  
- `creneauId` auto  
- Import Excel/CSV  
- Migration forcée des anciennes classes « Cycle d’orientation » / 5ᵉ–6ᵉ legacy (script séparé possible plus tard)

---

## 9. Critères d’acceptation

- [ ] PRIMAIRE : uniquement `1è-PR` … `6è-PR`  
- [ ] SECONDAIRE : `7è-TC` + `8è-TC` liés à section **CTEB** + option **Tronc commun**  
- [ ] SECONDAIRE : `1è`–`4è` liés à une **filière (section)** + **option** (ex. Scientifique / Biologie-Chimie)  
- [ ] Pas de classe Humanités sans option ; pas de 7è/8è hors Tronc commun  
- [ ] Re-clic : 0 doublon  
- [ ] Permissions + `branchId` OK  

---

## 10. Fichiers impactés

| Fichier | Action |
|---------|--------|
| `context/plan-import-catalogue-classes.md` | Ce plan |
| `lib/class-structure.ts` | Niveaux CTEB / Humanités |
| `lib/class-catalog.ts` | **Nouveau** |
| `lib/class-catalog-sync.ts` | **Nouveau** |
| `.../classe/classe.action.ts` | Import |
| `.../classe/components/ClassesClient.tsx` | Bouton |
| `.../classe/components/classe-form.tsx` | Labels + validation section/option |
| Seeds / tests | Optionnel |

---

## 11. Checklist avant lancement

- [x] **Référentiel pays** CTEB + Humanités (tableau §0)  
- [x] **D1** — nomenclature + section/option obligatoires  
- [x] **D2** — sans parallèle (**A**)  
- [ ] **D3** — A / B / C (défaut **B** + CTEB forcé)  
- [x] **D4** — page Classes (**A**)  
- [ ] Liste filières/options §4.2–4.3 : complète / restreindre  

---

## 12. Lancement par défaut

Si tu dis **« OK lance »** :

1. PRIMAIRE : `1è-PR` … `6è-PR`  
2. SECONDAIRE : `7è-TC` + `8è-TC` (section **Éducation de Base (CTEB)**, option **Tronc commun**)  
3. Humanités : `1è`–`4è` × options déjà créées (section = filière de l’option)  
4. **D3 = B**, **D2 = A**, **D4 = A**

Sinon précise `D3=A` ou `D3=C`.
