# Phase 08 - Inscription unifiee

## Objectif

Centraliser l'inscription dans un menu principal qui gere eleve, parent et affectation classe au meme endroit.

## Portee

- nouveau flux inscription
- selection/creation eleve
- selection/creation parent
- affectation classe
- ancien eleve et historique
- retrait des boutons creation directe eleve/parent

## Actions

1. Creer une page/menu principal `Inscription`.
2. Construire un formulaire en etapes :
   - eleve existant ou nouveau ;
   - parent existant ou nouveau ;
   - niveau/classe demandee ;
   - affectation automatique ;
   - confirmation.
3. Ajouter les actions serveur :
   - `createRegistrationFlowAction`
   - `findParentForRegistrationAction`
   - `findStudentHistoryAction`
   - `suggestNextClassAction`
4. Gerer ancien eleve :
   - reussi : classe montante ;
   - echoue : meme niveau ;
   - retour apres absence : choix manuel du niveau.
5. Retirer les boutons `Nouvel eleve` et `Ajouter un Tuteur`.
6. Garder pages eleve/parent pour consultation, details, modification et archivage.

## Bonnes pratiques

- Le flux inscription doit etre transactionnel.
- Les duplications eleve/parent doivent etre evitees par recherche.
- Les erreurs doivent etre affichees par etape.
- Les champs facultatifs doivent etre explicites.

## Securite

- Verifier `branchId` pour eleve, parent, classe, annee.
- Verifier permissions d'inscription.
- Eviter la creation de parent/eleve hors organisation courante.
- Ne pas exposer des donnees parent a un role non autorise.

## Tests manuels

- Nouvel eleve + nouveau parent.
- Nouvel eleve + parent existant.
- Ancien eleve reussi.
- Ancien eleve echoue.
- Ancien eleve qui revient apres plusieurs annees.
- Classe pleine avec affectation automatique.

## Validation avant passage

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Definition of Done

- Inscription est un menu principal.
- Creation eleve/parent se fait dans le flux inscription.
- Affectation automatique integree.
- Boutons directs retires des sous-menus eleve/parent.
