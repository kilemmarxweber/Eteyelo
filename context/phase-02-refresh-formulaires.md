# Phase 02 - Refresh et formulaires

## Objectif

Uniformiser le refresh des donnees apres create/update/archive/desactivation et nettoyer correctement les formulaires.

## Portee

- `section`
- `option`
- `classe`
- `creneau`
- `schoolYear`
- `cours`
- `coursPonderationOption`
- `teaching`
- `schedule`
- `frais`
- `paiement`
- `student`
- `parent`
- `classEnrollment`

## Actions

1. Standardiser les callbacks :
   - `onSuccess`
   - `onCreated`
   - `onUpdated`
   - `onArchived`
2. Fermer les dialogs apres succes.
3. Reset les formulaires en mode create.
4. Vider l'element selectionne apres update/archive/desactivation.
5. Utiliser `router.refresh()` quand la page depend de Server Components.
6. Utiliser un `refreshKey` local quand la table refetch cote client.
7. Ajouter `revalidatePath()` dans les server actions importantes.
8. Retirer tout `window.location.reload()` restant.

## Bonnes pratiques

- Ne pas melanger refresh global et reload navigateur.
- Le parent doit controler l'ouverture du dialog.
- Le formulaire ne doit pas garder les anciennes valeurs apres create.
- Les erreurs serveur doivent remonter dans le toast et/ou le formulaire.

## Securite

- Chaque action doit verifier `branchId`.
- Une action de mise a jour ne doit pas modifier une donnee d'une autre branche.
- Les listes doivent etre filtrees par branche.

## Tests manuels

- Creer un element dans chaque module cible.
- Modifier un element.
- Archiver/desactiver un element si la phase archive est deja disponible.
- Verifier que la table change sans reload complet.
- Verifier que le formulaire se vide apres creation.

## Validation avant passage

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Plus de reload navigateur dans les modules admin branches.
- Les tables se mettent a jour apres action.
- Les dialogs se ferment proprement.
