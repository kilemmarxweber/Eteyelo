# Unit 14 — Bulletins : dessiner le logo établissement

## Objectif

Utiliser `branchContext.logoUrl` déjà résolu dans le rendu PDF bulletin.

## Dépendances

- Unit 00 (optionnel si on réutilise seulement `resolveBulletinLogoUrl` existant)

## Portée

- `.../fiches/components/useBulletinPDF.tsx` (+ modules layout/render/footer)
- `lib/bulletin-context.ts` (vérif résolution)

## Actions

1. Dessiner le logo école dans l’en-tête bulletin (sans casser layout ministériel RDC/armoiries).
2. Fallback propre si logo absent.
3. Vérifier primaire et secondaire.

## Hors scope

- Remplacement des assets ministériels.
- Refonte complète du bulletin.

## Tests manuels

- Bulletin primaire + secondaire avec logo branche.
- Sans logo : layout inchangé / stable.
- Scripts `scripts/test-bulletin-*.ts` si encore pertinents.

## DoD

- Logo établissement visible sur bulletin quand configuré.
- Même source logo que reçu pour une branche donnée.
- `tsc` OK.
