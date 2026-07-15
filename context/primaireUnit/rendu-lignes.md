# Rendu des lignes — Bulletin primaire v2

Règles de dessin PDF pour chaque type de ligne, en utilisant la grille 21 cellules + BRANCHES.

## Types de lignes

| Type | Fonction cible | Priorité |
| --- | --- | --- |
| En-tête tableau | `drawPrimaryTableHeader` | Phase 2 |
| Titre domaine | `drawPrimaryDomainHeader` *(nouveau)* | Phase 4 |
| Cours / matière | `drawPrimaryMatiere` | Phase 3 |
| Maxima domaine | `drawPrimaryDomainMaximaRow` *(nouveau)* | Phase 4 |
| Maxima général | `drawPrimaryGeneralMaximaRow` *(nouveau)* | Phase 4 |
| Lignes générales | `drawPrimarySubjectRow` | Phase 6 |

## 1. En-tête tableau (`drawPrimaryTableHeader`)

- Colonne 0 : `BRANCHES` — fusion 3 niveaux.
- Colonnes 1–3 : titres trimestres + sous-libellés niveau 2 (voir `layout-entete-tableau.md`).
- Colonne finale : `MAX | PTS OBT` directement (pas de titre parent).
- **Pas** de niveau 3 avec texte — les valeurs numériques apparaissent sur les lignes MAXIMA.

## 2. Ligne titre domaine

```typescript
drawPrimaryDomainHeader(doc, y, layout, "DOMAINE DES LANGUES")
```

- Colonne BRANCHES : libellé domaine en gras, aligné à gauche.
- 21 cellules d'évaluation : vides, fond gris clair (`fill: #f0f0f0`).
- Hauteur : `maximaHeight` (identique aux autres lignes).

## 3. Ligne cours (`drawPrimaryMatiere`)

Pour chaque colonne de `PRIMARY_EVAL_COLUMNS` :

| `kind` | Contenu | Couleur |
| --- | --- | --- |
| `max-per` | Vide (sauf ligne maxima) | — |
| `period-score` | Note si active | `getColor(note, "score", max)` |
| `max-exam` | Vide | — |
| `pts-exam` | Note examen | `getColor` |
| `max-trim` | Vide | — |
| `pts-trim` | Total trimestre | `getColor` |
| `max-total` | Vide | — |
| `pts-total` | Total annuel | `getColor` |

## 4. Ligne MAXIMA domaine

```typescript
drawPrimaryDomainMaximaRow(doc, y, layout, domainBloc)
```

- Colonne BRANCHES : `MAXIMA LANGUES` (ou nom court du domaine).
- `max-per` : `max(p1)` du domaine (somme des cours).
- `period-score` : vide.
- `max-exam` : `max(examN)` du domaine.
- `pts-exam` : vide.
- `max-trim` : `max(TRIM N)` du domaine.
- `pts-trim` : vide.
- `max-total` : maxima annuel (colonne `MAX`).
- `pts-total` : vide.
- Style : `isMaxima: true` (police maxima existante).

## 5. Ligne MAXIMA GÉNÉRAL

- Colonne BRANCHES : `MAXIMA GÉNÉRAL`.
- Chaque cellule `max-*` : somme des 5 domaines.
- Placée **après** le dernier domaine, **avant** le bloc GENERAUX.

## 6. Lignes générales

Adapter `drawPrimarySubjectRow` pour la nouvelle grille :

### TOTAUX / POURCENTAGES

- Périodes : valeurs comme aujourd'hui.
- `MAX EX` : fond noir, vide ou maxima selon ligne.
- `PTS OBT` examen : valeur ou noir.
- `MAX TRIM` : fond noir.
- `PTS OBT` trimestre : total ou pourcentage.
- `MAX` (colonne finale) : maxima annuel.
- `PTS OBT` (colonne finale) : total annuel ou %.

### SIGNATURE PARENTS

- Toutes les 21 cellules vides avec bordures légères.

## Ordre de dessin dans `useBulletinPDF`

```text
drawPrimaryTableHeader()
for (domain of domainBlocs) {
  drawPrimaryDomainHeader()
  for (subject of domain.subjects) {
    drawPrimaryMatiere()
  }
  drawPrimaryDomainMaximaRow()
}
drawPrimaryGeneralMaximaRow()
for (row of generauxRows) {
  drawPrimarySubjectRow()
}
```

## Pagination

- Conserver la logique actuelle de saut de page dans `useBulletinPDF.tsx`.
- Un domaine ne doit pas être coupé si possible (garder domaine + maxima ensemble).

## Tests visuels

Après chaque phase, régénérer :

```bash
pnpm tsx scripts/test-bulletin-visual-primary.ts
```

Comparer avec `context/samples/phase-11/` et sauvegarder dans `context/samples/primaireUnit-v2/`.
