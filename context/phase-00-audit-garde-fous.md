# Phase 00 - Audit et garde-fous

## Objectif

Preparer l'implementation sans changer le comportement metier. Cette phase sert a cartographier les zones sensibles et a poser les conventions a respecter dans toutes les phases suivantes.

## Portee

- audit des actions serveur ;
- audit des suppressions physiques ;
- audit des formulaires create/update ;
- audit des refresh de tables ;
- audit des menus et routes ;
- audit des contraintes `branchId`, `organizationId`, roles et `typebranch`.

## Actions

1. Lister les actions serveur create/update/delete/status/archive.
2. Identifier les actions qui n'utilisent pas `requireBranchContext`.
3. Identifier les actions qui font un `prisma.*.delete`.
4. Identifier les composants `Delete...Dialog`.
5. Identifier les formulaires avec `defaultValues` incomplets.
6. Identifier les pages/tables qui ne font pas `router.refresh`, `refreshKey` ou `revalidatePath`.
7. Identifier les routes ou menus qui doivent etre adaptes au type de branche.
8. Noter les modules qui touchent l'historique : notes, bulletins, inscriptions, paiements, presences.

## Bonnes pratiques

- Ne pas corriger pendant l'audit, sauf anomalie bloquante explicitement isolee.
- Noter les fichiers touches dans un journal de phase.
- Ne jamais transformer une suppression en archive sans comprendre les relations Prisma.
- Ne jamais retirer une relation historique : bulletin, paiement, inscription, presence.

## Securite

- Verifier que chaque action serveur limite les donnees par `branchId`.
- Verifier que les operations organisation utilisent `organizationId`.
- Verifier les roles avant les actions sensibles.
- Ne pas exposer les archives a des roles non autorises.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Sortie attendue

- liste des fichiers a modifier par phase ;
- liste des suppressions a convertir en archive/desactivation ;
- liste des formulaires a stabiliser ;
- liste des modules avec refresh incomplet.
