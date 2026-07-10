# Phase 04 - Vacation et creneau

## Objectif

Corriger l'erreur React uncontrolled/controlled dans le formulaire vacation/creneau et conserver le design de recreation.

## Portee

- `creneau-form.tsx`
- schema `creneau`
- page/table creneau si refresh incomplet

## Actions

1. Definir tous les champs dans `defaultValues`.
2. Normaliser `initialData` en mode update.
3. Ajouter `form.reset()` quand `initialData` change.
4. Eviter `parseInt("")` qui produit `NaN`.
5. Utiliser des fallback controllees pour les inputs time/number.
6. Verifier que la recreation reste au milieu avec son design.
7. Verifier le reset apres creation.

## Bonnes pratiques

- Un input doit etre controle pendant toute sa vie.
- Les champs number doivent convertir proprement les valeurs vides.
- Les time inputs doivent toujours recevoir une string.

## Securite

- Verifier que creation/update creneau reste limitee a la branche courante.
- Eviter les chevauchements si la regle metier l'exige.

## Tests manuels

- Ouvrir create vacation.
- Ouvrir update vacation.
- Modifier horaires et durees.
- Soumettre create et update.
- Verifier la console navigateur : aucun warning uncontrolled/controlled.

## Validation avant passage

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Plus de warning React.
- Formulaire stable en create et update.
- Refresh table OK apres succes.
