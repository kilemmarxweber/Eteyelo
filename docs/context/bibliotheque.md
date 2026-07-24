# Contexte — Bibliothèque en ligne (PDF + EPUB, curriculum RDC)

> Document de plan produit / technique.  
> Objectif : permettre aux **élèves authentifiés** de **consulter en lecture seule** des livres scolaires numériques (primaire → humanités RDC), gérés par l’établissement, avec lecteur intégré PDF/EPUB.  
> Surfaces cibles :
> - Fiche publique : carte « Bibliothèque » (info seulement — pas de lecture anonyme)
> - Élève : `/admin/.../branches/[branchId]/bibliotheque` (ou espace élève) — **lecture seule, auth STUDENT**
> - Admin : même zone admin — CRUD upload / activation  
> Statut : **MVP phases 1–8 livré** (seed RDC + stockage S3/R2) — juillet 2026.

---

## 1. État actuel

| Élément | Situation |
|--------|-----------|
| Fiche établissement | `app/components/etablissements/[branchId]/page.tsx` — carte **Bibliothèque** placeholder (« À connecter avec un champ hasLibrary ») |
| Liste établissements | `app/components/etablissements/page.tsx` — pas de lien bibliothèque |
| Modèle Prisma | **aucun** `LibraryBook` |
| Upload existant | `lib/upload-file.server.ts` + `/api/uploads/[fileName]` — images + PDF (max 10 Mo docs) ; **pas d’EPUB**, pas de sous-dossier `books/` |
| Stockage cloud | Non branché (pas Cloudinary / S3 / Supabase / Firebase) |
| Lecteurs PDF/EPUB | Non installés (`react-pdf`, `pdfjs-dist`, `react-reader`, `epubjs`) |
| Catalogue RDC | Aucun seed / catalogue national |

### Fichiers à créer / étendre

| Zone | Chemin prévu |
|------|----------------|
| Schéma | `prisma/schema.prisma` → `LibraryBook` + relation `Branch.libraryBooks` |
| Admin CRUD | `app/admin/.../[branchId]/bibliotheque/` |
| Consultation élève | Route auth STUDENT (ex. sous branche admin / espace élève) — **pas** de catalogue public |
| Lecteurs | `components/library/pdf-reader.tsx`, `epub-reader.tsx` |
| Upload | étendre `lib/upload-file.server.ts` (MIME EPUB, taille livres, préfixe `books/`) |
| Seed catalogue | `prisma/seeds/seedLibraryBooks.ts` + métadonnées JSON |
| Permissions | `lib/permissions.ts` (optionnel V2 : `library:read` / `library:manage`) |

---

## 2. Objectifs produit

1. **Consulter en lecture seule** des livres scolaires PDF/EPUB (pas de téléchargement).
2. **Réservé aux élèves** de la branche (session Better Auth, rôle `STUDENT`).
3. **Catalogue RDC** : primaire (1ᵉ–6ᵉ) → secondaire / humanités, toutes sections utiles.
4. **Gestion par branche** : chaque établissement gère son fonds (upload, activation, catégories).
5. **Fiche publique** : indiquer que la bibliothèque existe (carte), sans exposer le catalogue ni les fichiers.
6. **Scalabilité stockage** : local MVP → cloud Pro (`fileUrl` en DB).

---

## 3. Décisions produit — **figées**

### 3.1 Accès & audience — **FIGÉ**

| Règle | Comportement |
|-------|----------------|
| Mode lecture | **Lecture seule** pour les élèves — aucun téléchargement |
| Qui **gère** (CRUD + lecture) | **Owner plateforme**, **propriétaire org**, **gestionnaire** (+ préfet / directeur / superviseur) : upload + lecture |
| Qui **consulte** (lecture seule) | Membre branche rôle **`STUDENT`** |
| Anonyme / parent / enseignant / caissier | **Pas d’accès** au catalogue ni au lecteur (MVP) |
| Fiche `/etablissements/[id]` | Carte Bibliothèque = **teaser** (`hasLibrary` / compteur optionnel) + CTA « Se connecter pour lire » — **pas** de grille publique |
| Visibilité livres | Tous les livres = **`STUDENTS`** (pas de mode PUBLIC en MVP) |
| `allowDownload` | Toujours **`false`** en MVP (colonne gardée pour V2 éventuelle, UI admin sans option) |

**Protection fichiers (stricte)** :
1. Le client ne reçoit **jamais** `fileUrl` brut — uniquement `bookId` ; le lecteur appelle un proxy auth.
2. Route unique `/api/library/[bookId]/file` : session + `BranchMember` (`STUDENT` + même `branchId`) + livre `isActive` → stream `inline` (jamais `attachment`).
3. Fichiers livres **hors** `public/` et **hors** `/api/uploads` générique (dossier privé / bucket privé).
4. Admin : gate CRUD séparée ; pas d’URL permanente exposée dans le HTML/JSON catalogue.

### 3.2 Formats & lecteur

| Format | Lecteur | Notes |
|--------|---------|--------|
| `pdf` | `react-pdf` + `pdfjs-dist` | Worker PDF.js côté client ; lazy load |
| `epub` | `react-reader` + `epubjs` | Navigation chapitres, thème clair |
| Autres (doc, images) | **Hors MVP** | Pas de Word dans le lecteur |

```tsx
{book.fileType === "pdf" && <PdfReader bookId={book.id} />}
{book.fileType === "epub" && <EpubReader bookId={book.id} />}
// Lecteur → GET /api/library/[bookId]/file (cookie session) — jamais book.fileUrl
```

### 3.3 Stockage des fichiers (stratégie en 2 temps)

| Phase | Approche | Pourquoi |
|-------|----------|----------|
| **MVP (simple)** | Fichiers dans dossier **privé** (ex. `UPLOAD_DIR/books/…`) ; lecture **uniquement** via `/api/library/[bookId]/file` | Pas d’URL publique ; `fileUrl` reste côté serveur |
| **Pro** | Cloudinary **ou** S3 / R2 / Supabase Storage / Firebase → stocker **uniquement l’URL** dans `LibraryBook.fileUrl` | Gros PDF, CDN, backups, pas de disque serveur |

**Recommandation MVP** : ne **pas** committer des PDF dans `public/uploads/books` du repo Git (poids, licence, secrets). Uploader via admin ; seed = métadonnées + URLs externes ou fichiers locaux hors Git (`.gitignore`).

**Recommandation Pro (après MVP)** : **Cloudflare R2** ou **Supabase Storage** (S3-compatible) — coût bas pour gros volumes scolaires ; Cloudinary OK si déjà utilisé pour images, mais moins naturel pour EPUB volumineux.

Abstraction prévue :

```ts
// lib/library/storage.ts
uploadLibraryFile(file) → { fileUrl, fileSize, mimeType }
deleteLibraryFile(fileUrl)
```

L’UI et Prisma ne changent pas quand on passe local → cloud.

### 3.4 Contenu pédagogique RDC (taxonomie)

Ne pas se limiter à `category` / `level` libres. Structurer pour le programme congolais :

| Champ | Exemples |
|-------|----------|
| `cycle` | `PRIMAIRE` \| `SECONDAIRE` \| `HUMANITES` |
| `level` | `1ère`…`6ème` (primaire) ; `7ème`/`1ère secondaire`…`6ème secondaire` / `Humanités` |
| `section` | `GENERALE`, `LITTERAIRE`, `SCIENTIFIQUE`, `PEDAGOGIQUE`, `COMMERCIALE`, `TECHNIQUE`, `CUT`, … |
| `subject` | Français, Mathématiques, Sciences, Histoire, Géographie, Éducation civique, Anglais, Latin, Physique, Chimie, Biologie, Économie, Informatique, Religion, Arts,technologie,culture generale,comptabilite,philosophie,romans … |
| `language` | `fr`, `ln` (lingala), `sw`, `en`, … |
| `source` | `SCHOOL_UPLOAD` \| `OPEN_LICENSE` \| `PLATFORM_CATALOG` |

**Filtres UI** : cycle → niveau → matière → section → recherche titre/auteur.

### 3.5 Catalogue « maximum de livres » — réalisme juridique

| Source | Usage | Risque |
|--------|-------|--------|
| Uploads de l’école (manuels scannés / acquis) | Responsabilité établissement | Copyright éditeurs EPST / privés |
| Ressources **ouvertes** (domaine public, Creative Commons, manuels libres) | Seed plateforme | Faible si licence respectée |
| Liens vers sites officiels / partenaires | `fileUrl` externe + `external=true` | Dépendance réseau |
| Contenu généré / résumés | V3 | Qualité pédagogique |

**Règle produit** : Kalasa fournit l’**infra bibliothèque** + un **catalogue seed ouvert** (métadonnées + fichiers libres). Les manuels commerciaux RDC sont **ajoutés par chaque école** (ou via partenariat éditeur), jamais scrapés / piratés.

#### Catalogue seed cible (métadonnées + fichiers libres)

Couverture minimale MVP seed (exemples de **types**, pas des titres protégés) :

| Cycle | Matières prioritaires |
|-------|----------------------|
| Primaire 1–6 | Lecture / français, maths, éveil scientifique, histoire-géo, éducation civique, arts |
| Secondaire 1–2 (tronc commun) | Français, maths, sciences, anglais, histoire, géo, éducation civique |
| Humanités 3–6 | Par section : philo / latin / maths / physique-chimie / bio / économie / pédagogie / commerce |

Chaque entrée seed : titre, auteur/éditeur, cycle, level, subject, cover, `fileUrl` (PDF/EPUB libre), `license` (ex. `CC-BY-SA`, `Public Domain`).

V2 : import CSV/JSON admin pour enrichir rapidement le fonds d’une branche.

### 3.6 UX surfaces

| Surface | Contenu |
|---------|---------|
| Fiche `/etablissements/[id]` | Remplacer le placeholder : badge « Disponible pour les élèves » + CTA connexion (pas de catalogue public) |
| Catalogue / lecteur | Route **authentifiée élève** uniquement (ex. sous admin branche ou `/eleve/.../bibliotheque`) |
| Admin branche | Liste, upload, édition, activer/désactiver — **pas** d’option download / public |
| Lecteur plein écran | Mobile-first, pagination PDF, TOC EPUB ; **aucun** bouton télécharger / imprimer agressif |

---

## 4. Modèle de données (amélioré)

### 4.1 Modèle proposé (au-delà du draft initial)

```prisma
enum LibraryCycle {
  PRIMAIRE
  SECONDAIRE
  HUMANITES
}

enum LibraryFileType {
  PDF
  EPUB
}

enum LibraryVisibility {
  STUDENTS // MVP : seule valeur utilisée
  // PUBLIC — réservé V2 (hors scope)
}

enum LibrarySource {
  SCHOOL_UPLOAD
  OPEN_LICENSE
  PLATFORM_CATALOG
}

model LibraryBook {
  id          String   @id @default(cuid())
  title       String
  author      String?
  publisher   String?
  description String?  @db.Text
  coverImage  String?

  fileUrl     String
  fileType    LibraryFileType
  fileSize    Int?       // octets
  pageCount   Int?
  language    String     @default("fr")
  license     String?    // "CC-BY", "All rights reserved", etc.
  isbn        String?

  cycle       LibraryCycle?
  level       String?    // "3ème primaire", "6ème secondaire", …
  section     String?    // SCIENTIFIQUE, LITTERAIRE, …
  subject     String?    // Mathématiques, …
  category    String?    // tag libre additionnel (romans, manuels, annales…)
  tags        String[]   @default([])

  visibility    LibraryVisibility @default(STUDENTS)
  allowDownload Boolean           @default(false) // MVP : toujours false, pas de toggle admin
  isActive      Boolean           @default(true)
  source        LibrarySource     @default(SCHOOL_UPLOAD)
  sortOrder     Int               @default(0)

  /// Compteurs légers (consultation)
  viewCount     Int               @default(0)

  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?

  @@index([branchId])
  @@index([branchId, isActive])
  @@index([cycle])
  @@index([level])
  @@index([subject])
  @@index([category])
  @@index([visibility])
  @@index([fileType])
}
```

Sur `Branch` :

```prisma
libraryBooks LibraryBook[]
/// Optionnel : raccourci UI fiche publique
hasLibrary   Boolean @default(false) // ou dérivé: count(libraryBooks where isActive) > 0
```

**Améliorations vs draft initial** : `fileType` obligatoire, accès **élèves only** + **lecture seule**, taxonomie RDC, licence, taille, compteur vues, source catalogue.

### 4.2 Hors MVP (prévoir sans coder)

| Modèle | Usage |
|--------|-------|
| `LibraryReadingProgress` | Reprendre page/chapitre par élève |
| `LibraryFavorite` | Favoris élève |
| `LibraryCollection` | « Annales exam », « Lecture obligatoire 5ème » |

---

## 5. Architecture technique

```
[Admin upload] → lib/library/storage.ts → fileUrl (serveur only)
                      ↓
              LibraryBook (Prisma)
                      ↓
     [Catalogue élève auth] → filtres → détail (bookId, jamais fileUrl)
                      ↓
              PdfReader | EpubReader → GET /api/library/[bookId]/file
                      ↓
              Gate STUDENT + stream inline (privé)
```

### Dépendances

```bash
pnpm add react-pdf pdfjs-dist react-reader epubjs
```

Types éventuels : `@types` selon besoin ; config Next pour worker PDF.js (`copy-webpack-plugin` / `public/pdf.worker.min.mjs` ou CDN).

### Contraintes Next.js

- Lecteurs = **Client Components** (`"use client"`).
- Pages catalogue = Server Components + actions serveur pour liste filtrée.
- CORS : si `fileUrl` cloud, autoriser le domaine app à lire le blob.
- Limite upload : monter `MAX_DOCUMENT_UPLOAD_BYTES` pour livres (ex. **50 Mo**) + MIME `application/epub+zip`.

---

## 6. Plan d’exécution par phases

### Phase 0 — Cadrage (0,5 j)

- [x] Accès figé : **élèves only** + **lecture seule** (pas de download).
- [x] Stockage MVP = dossier privé `.data/library-books` + proxy `/api/library/[bookId]/file`.
- [ ] Lister 20–40 entrées seed **libres de droits** (métadonnées) pour démo RDC.
- [x] Emplacement UI : carte fiche établissement + route `/admin/.../bibliotheque`.

**Livrable** : ce document + checklist décisions figées (§3).

---

### Phase 1 — Schéma & permissions (0,5–1 j)

- [x] Ajouter `LibraryBook` + enums + relation `Branch`.
- [x] Migration Prisma (`20260724120000_library_books` + `db push` local).
- [x] `hasLibrary` dérivé via `_count.libraryBooks`.
- [x] Gate admin / élève : `lib/library/access.ts` + `canAccessLibraryArea`.

**Livrable** : DB prête, types générés.

---

### Phase 2 — Storage & upload livres (1 j)

- [x] MIME PDF + EPUB, limite 50 Mo.
- [x] Stockage privé `library-books/{branchId}/…`.
- [x] API `POST /api/library/books` (FormData) + validation Zod.
- [x] `lib/library/storage.ts` (swap cloud futur).

**Livrable** : upload admin → `fileUrl` persisté.

---

### Phase 3 — Admin CRUD bibliothèque (1–2 j)

- [x] Route admin `…/[branchId]/bibliotheque`.
- [x] Table admin shadcn + dialogs create/edit/disable/delete.
- [x] Upload cover (image) + fichier livre.
- [x] Menu « Bibliothèque » (Cursus) — `LIBRARY_ROLES`.
- [x] Pas de toggle download / public.

**Livrable** : gestionnaire peut publier des livres pour les élèves.

---

### Phase 4 — Catalogue élève authentifié (1–2 j)

- [x] Teaser fiche établissement (compteur + réservé élèves).
- [x] Catalogue protégé (élève / manager) avec filtres shadcn.
- [x] Page détail + lecteur.
- [x] Gate `STUDENT` / manage sur `branchId`.

**Livrable** : seuls les élèves (et managers) de la branche voient le catalogue.

---

### Phase 5 — Lecteurs PDF + EPUB (lecture seule) (1–2 j)

- [x] `react-pdf` / `pdfjs-dist` / `react-reader` / `epubjs`
- [x] `PdfReader` / `EpubReader` via `bookId` (pas `fileUrl`).
- [x] Proxy `/api/library/[bookId]/file` + `inline` + `Cache-Control: private, no-store`.
- [x] `viewCount` incrémenté à la lecture.

**Livrable** : lecture in-app, fichiers non exposés publiquement.

---

### Phase 6 — Catalogue seed RDC ouvert (1–2 j)

- [x] JSON/seed `prisma/seeds/library-rdc-open.json` (26 titres, CC0).
- [x] Script seed : `pnpm seed:library` → branches actives (`visibility=STUDENTS`).
- [x] Covers placeholder brand (`KLAMBOCORE_DEFAULT_IMAGE_PATH`).
- [x] PDF générés localement (contenu libre, pas de manuels commerciaux).

**Livrable** : démo riche « primaire → humanités » sans fichiers piratés.

---

### Phase 7 — Durcissement accès élève (0,5–1 j)

- [x] Helper `enforceLibraryAccess` / `resolveLibraryFileAccess`.
- [x] Entrée menu élève « Bibliothèque ».
- [x] `notFound` / 401 / 403 sur routes catalogue et fichier.
- [x] Fichiers hors `public/` et hors `/api/uploads`.

**Livrable** : accès élève verrouillé de bout en bout.

---

### Phase 8 — Stockage Pro + perf (1–2 j) — Option Pro

- [x] Adapter S3-compatible (R2 / Supabase / AWS) dans `lib/library/storage.ts`.
- [x] Variables d’env documentées (`.env` + ce doc).
- [x] Script migration local → cloud : `pnpm migrate:library-s3`.
- [x] Proxy lecture unifié (`openLibraryFileStream`) local + S3.
- [ ] Miniatures cover via transform image (optionnel V2).

**Livrable** : gros volumes via CDN/objet privé sans saturer le disque serveur.

---

### Phase 9 — Polish & analytics (0,5–1 j) — V2

- [ ] Empty states, skeleton, SEO titre page bibliothèque.
- [ ] Export liste livres Excel (admin).
- [ ] Stats simples : top livres (`viewCount`), couverture par matière.
- [ ] Favoris / progression lecture (si demandé).

---

## 7. Structure UI proposée (`etablissements`)

```
# Catalogue / lecteur — AUTH STUDENT uniquement
app/admin/.../[branchId]/bibliotheque/   # ou espace élève dédié
  (student) page catalogue + [bookId] lecteur

app/components/etablissements/[branchId]/page.tsx
  → Card Bibliothèque : teaser + CTA login (pas de lecture publique)

app/admin/.../[branchId]/bibliotheque/
  page.tsx
  bibliotheque.action.ts
  components/
    books-table.tsx
    book-form-dialog.tsx
    columns.tsx
```

Composants partagés :

```
components/library/
  pdf-reader.tsx
  epub-reader.tsx
  book-card.tsx
  book-filters.tsx
```

---

## 8. Critères d’acceptation (MVP)

1. Un admin peut créer un livre PDF ou EPUB avec cover, cycle, niveau, matière.
2. Seul un **élève authentifié** de la branche voit le catalogue et ouvre le lecteur.
3. Clic « Lire » ouvre le bon lecteur selon `fileType` — **aucun** bouton télécharger.
4. Anonyme / autre rôle : pas de listing, pas d’accès fichier (403 / login).
5. Fiche établissement : teaser bibliothèque uniquement (pas de lecture publique).
6. Aucun gros PDF n’est versionné dans Git.
7. Seed open-license couvrant primaire + secondaire/humanités (métadonnées).

---

## 9. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| Copyright manuels RDC | Seed ouvert seulement ; TOS école responsable des uploads |
| PDF lourds / RAM serveur | Stockage Pro + limite taille + streaming CDN |
| PDF.js worker Next | Documenter config worker dans `public/` |
| EPUB mobile fragile | Tester iOS Safari ; fallback message |
| Catalogue vide au lancement | Phase 6 seed obligatoire avant démo client |
| Confusion public vs privé | Plus de mode public MVP ; carte établissement = teaser + login uniquement |

---

## 10. Ordre de livraison recommandé

| Sprint | Phases | Résultat utilisateur |
|--------|--------|----------------------|
| Sprint A | 0 → 3 | Admin peut uploader |
| Sprint B | 4 → 5 + 7 | Élèves lisent (lecture seule, auth) |
| Sprint C | 6 | Catalogue RDC démo seed |
| Sprint D | 8 → 9 | Cloud + polish |

---

## 11. Améliorations retenues par rapport à l’idée initiale

| Idée initiale | Amélioration |
|---------------|--------------|
| `fileUrl` + category/level | + `fileType`, taxonomie RDC, **élèves only**, **lecture seule** |
| `/public/uploads/books` en Git | Upload via API existante ; fichiers hors repo |
| Cloudinary/S3 direct | Abstraction storage : local MVP → cloud Pro sans changer le modèle |
| Lecteurs PDF/EPUB | Conservés ; Client Components + worker PDF.js |
| « Maximum de livres » | Catalogue seed **légal** + import école ; pas de scraping |
| Composant établissements | Brancher le placeholder `LibraryBig` déjà présent |
| Modèle minimal | Prêt pour stats, favoris, progression (V2) sans refonte |

---

## 12. Prochaines actions concrètes

1. ~~Valider accès / download~~ → **figé** : lecture seule + élèves only.
2. Choisir provider Pro cible (optionnel, après MVP).
3. Lancer **Phase 1** (schéma Prisma).
4. Constituer la liste seed open-license (titres + licences + fichiers).
5. Sprint A (admin) puis Sprint B (catalogue + lecteur élève).

---

*Document vivant — mettre à jour le statut en tête de fichier à chaque phase livrée.*
