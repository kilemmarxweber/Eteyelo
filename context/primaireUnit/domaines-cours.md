# Domaines — Regroupement des cours primaires

Disposition officielle du bulletin primaire RDC (degré moyen), telle que visible sur le modèle fourni.

Les cours ne sont **pas** listés à plat : ils sont organisés en **3 niveaux** — domaine → section → cours — avec des lignes **Sous-total** par section.

---

## Hiérarchie d'affichage

```text
DOMAINE (titre centré, majuscules, sur toute la largeur)
  └─ SECTION (sous-en-tête gras, aligné à gauche)
       ├─ cours 1
       ├─ cours 2
       └─ Sous-total (gras, somme des maxima de la section)
  └─ cours autonome (sans section intermédiaire)
```

| Niveau | Style PDF | Colonnes notes |
| --- | --- | --- |
| **Domaine** | Centré, majuscules, fond gris | Vides |
| **Section** | Gras, aligné à gauche (col. BRANCHES) | Vides |
| **Cours** | Normal, aligné à gauche | Notes élève |
| **Sous-total** | Gras | Maxima agrégés (ligne maxima de section) |

---

## Les 5 domaines

| Ordre | Code | Libellé affiché |
| --- | --- | --- |
| 1 | `LANGUES` | **DOMAINE DES LANGUES** |
| 2 | `MATH_SCIENCES_TECH` | **DOMAINES DES MATHEMATIQUES, SCIENCES ET TECHNOLOGIE** |
| 3 | `UNIVERS_SOCIAUX` | **DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT** |
| 4 | `ARTS` | **DOMAINE DES ARTS ET CULTURE** |
| 5 | `DEVELOPPEMENT` | **DOMAINE DE DEVELOPPEMENT PERSONNEL** |

> Les domaines 3 à 5 suivent la même logique hiérarchique ; leur détail cours par cours sera complété à partir du bulletin complet. Les domaines 1 et 2 ci-dessous sont extraits du modèle fourni.

---

## 1. DOMAINE DES LANGUES

### Section : LANGUES CONGOLAISES

| Cours | Max Per | Max Exam | Max TRIM | MAX | PTS OBT |
| --- | ---: | ---: | ---: | ---: | ---: |
| Exp. Orale & V | 10 | 20 | 40 | 120 | |
| Grammaire & C | 10 | 20 | 40 | 120 | |
| Orth. & Redact | 5 | 10 | 20 | 60 | |
| **Sous-total** | **25** | **50** | **100** | **300** | |

### Section : FRANÇAIS

| Cours | Max Per | Max Exam | Max TRIM | MAX | PTS OBT |
| --- | ---: | ---: | ---: | ---: | ---: |
| Exp. Orale-Reci | 10 | 20 | 40 | 120 | |
| Orth. Phra. Ecrit | 10 | 20 | 40 | 120 | |
| Gram-Conj-Ana | 15 | 30 | 60 | 180 | |
| **Sous-total** | **35** | **70** | **140** | **420** | |

### Cours autonomes (hors section)

| Cours | Max Per | Max Exam | Max TRIM | MAX | PTS OBT |
| --- | ---: | ---: | ---: | ---: | ---: |
| LECT.-ECRITURE EN LANGUES CONG | 30 | 60 | 120 | 360 | |
| LECT.-ECRITURE EN LANGUES FRAN | 30 | 60 | 120 | 360 | |

---

## 2. DOMAINES DES MATHEMATIQUES, SCIENCES ET TECHNOLOGIE

### Section : MATHEMATIQUES

| Cours | Max Per | Max Exam | Max TRIM | MAX | PTS OBT |
| --- | ---: | ---: | ---: | ---: | ---: |
| Numération | 10 | 20 | 40 | 120 | |
| Opérations | 10 | 20 | 40 | 120 | |
| Mésures des G | 10 | 20 | 40 | 120 | |
| Formes Géomé | 10 | 20 | 40 | 120 | |
| Problèmes | 20 | 40 | 80 | 240 | |

> La capture fournie s'arrête à « Problèmes ». Les sections **Sciences** et **Technologie** (et leur sous-total) seront ajoutées lors de la réception du bulletin complet.

---

## 3. DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT

Structure attendue (même logique que les domaines 1 et 2) :

```text
DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT
  └─ [Section — ex. ÉVEIL / SCIENCES HUMAINES]
       ├─ cours…
       └─ Sous-total
```

*Détail cours/maxima : à compléter.*

---

## 4. DOMAINE DES ARTS ET CULTURE

Structure attendue :

```text
DOMAINE DES ARTS ET CULTURE
  └─ [Section — ex. ARTS PLASTIQUES / MUSIQUE]
       ├─ cours…
       └─ Sous-total
```

*Détail cours/maxima : à compléter.*

---

## 5. DOMAINE DE DEVELOPPEMENT PERSONNEL

Structure attendue :

```text
DOMAINE DE DEVELOPPEMENT PERSONNEL
  └─ [Section — ex. ÉDUCATION PHYSIQUE / ÉDUCATION À LA VIE]
       ├─ cours…
       └─ Sous-total
```

*Détail cours/maxima : à compléter.*

---

## Colonne finale : MAX | PTS OBT

La dernière colonne du tableau n'a **pas** de titre parent « TOTAL » ni « TG ». Elle affiche directement deux sous-colonnes :

| Sous-colonne | Contenu |
| --- | --- |
| **MAX** | Somme des 3 maxima trimestriels (`Max TRIM` T1 + T2 + T3) |
| **PTS OBT** | Somme des points obtenus sur l'année |

Exemple : un cours avec `Max TRIM = 40` par trimestre affiche `MAX = 120`.

---

## Structure PDF d'un bloc domaine

```text
┌──────────────────────────────────────────────────────────────────────────┐
│              DOMAINE DES LANGUES          (titre centré, fond gris)      │
├──────────────────────────────────────────────────────────────────────────┤
│ LANGUES CONGOLAISES                       (section gras, cellules vides) │
│ Exp. Orale & V    │    │    │    │    │ 40 │    │ ... │ 120 │           │
│ Grammaire & C     │    │    │    │    │ 40 │    │ ... │ 120 │           │
│ Orth. & Redact    │    │    │    │    │ 20 │    │ ... │  60 │           │
│ Sous-total        │ 25 │    │    │ 50 │    │100 │    │ 300 │           │
├──────────────────────────────────────────────────────────────────────────┤
│ FRANÇAIS                                  (section gras)               │
│ Exp. Orale-Reci   │    │    │    │    │ 40 │    │ ... │ 120 │           │
│ …                 │    │    │    │    │    │    │     │     │           │
│ Sous-total        │ 35 │    │    │ 70 │    │140 │    │ 420 │           │
├──────────────────────────────────────────────────────────────────────────┤
│ LECT.-ECRITURE EN LANGUES CONG            │    │    │    │120 │    │360│
│ LECT.-ECRITURE EN LANGUES FRAN             │    │    │    │120 │    │360│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Règles de regroupement

1. **Ordre fixe** : domaines 1 → 5, puis sections et cours dans l'ordre du bulletin officiel.
2. **Ligne domaine** : texte centré sur toute la largeur du tableau, majuscules.
3. **Ligne section** : gras, aligné à gauche dans BRANCHES, cellules d'évaluation vides.
4. **Ligne Sous-total** : gras ; affiche la **somme des maxima** de la section (Max Per, Max Exam, Max TRIM, MAX) — pas les notes élève.
5. **Maxima variables** : chaque cours a ses propres maxima (ex. Orth. & Redact = 5/10/20, Problèmes = 20/40/80) ; ne pas supposer 10/20/40 pour tous.
6. **MAXIMA GÉNÉRAL** : somme de tous les cours du bulletin, placé après le dernier domaine.

---

## Modèle de données (phase 5)

```prisma
enum PrimaryDomain {
  LANGUES
  MATH_SCIENCES_TECH
  UNIVERS_SOCIAUX
  ARTS
  DEVELOPPEMENT
}

enum PrimarySectionKind {
  SECTION    // sous-en-tête (ex. FRANÇAIS)
  COURS      // matière notée
  SOUS_TOTAL // ligne agrégée
  AUTONOME   // cours sans section parente
}

model Cours {
  // ... existant
  primaryDomain   PrimaryDomain?
  primarySection  String?        // ex. "LANGUES CONGOLAISES", "MATHEMATIQUES"
  sectionKind     PrimarySectionKind @default(COURS)
  domainOrder     Int?           // ordre absolu dans le bulletin
  maxPer          Int?           // maxima période (si différent du défaut)
  maxExam         Int?           // maxima examen
}
```

### Fallback sans migration

Mapping statique dans `lib/primary-domains.ts` reproduisant exactement les tableaux ci-dessus.

---

## Interface TypeScript cible

```typescript
type PrimarySection = {
  label: string;              // "LANGUES CONGOLAISES", "FRANÇAIS", …
  courses: PrimaryCourse[];
  sousTotal?: PrimaryMaximaRow;
};

type PrimaryCourse = {
  name: string;
  maxPer: number;
  maxExam: number;
  maxTrim: number;            // maxPer + maxPer + maxExam (2 périodes + examen)
  maxAnnuel: number;          // maxTrim × 3
  subject?: Subject;          // données notes élève
};

type PrimaryDomainBloc = {
  domain: PrimaryDomain;
  label: string;              // "DOMAINE DES LANGUES"
  sections: PrimarySection[];
  autonomes: PrimaryCourse[]; // LECT.-ECRITURE…
};

type PrimaryBulletinBlocs = {
  domainBlocs: PrimaryDomainBloc[];
  maximaGeneral: PrimaryMaximaRow;
  generauxBloc: GenerauxBloc;
};
```

---

## Remplacement de l'ancien regroupement

| Ancien (`useBulletinPDF.tsx`) | Nouveau |
| --- | --- |
| `courseBlocsMap` par signature maxima | `domainBlocs` par domaine + section |
| `blocName = ""` | Sections nommées (`LANGUES CONGOLAISES`, etc.) |
| Liste plate de cours | Hiérarchie domaine → section → cours → sous-total |
| Maxima uniformes | Maxima par cours (5, 10, 15, 20, 30…) |
| Colonne `TG` | `MAX \| PTS OBT` (sans titre parent) |
