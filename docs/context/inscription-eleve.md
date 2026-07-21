# Contexte — Inscription élève publique (`/inscription-eleve`)

> Document de plan produit / technique.  
> Objectif : après choix de l’école, exposer conditions dynamiques, frais d’inscription et programme de rentrée ; améliorer le design (shadcn).  
> Statut : **en cours / livré phases 1–5 (MVP)** — juillet 2026.

---

## Libellés selon le type de branche

Les textes UI utilisent `getPeopleLabels(typebranch)` (`lib/people-labels.ts`) :

| Type | Personne | Ex. matricule |
|------|----------|----------------|
| PRIMAIRE / SECONDAIRE / ATELIER | Élève | Matricule élève |
| CENTRE_FORMATION | Apprenant | Matricule apprenant |
| UNIVERSITE | Étudiant | Matricule étudiant |

Ces libellés s'appliquent dans l'admin branche (inscription, liste, paiements, dashboard, profil) et sur le formulaire public une fois l'établissement sélectionné.

**Centre de formation :** aucun parent à saisir à l'inscription (admin et formulaire public `/inscription-eleve`). Un parent technique unique (`Parent Systeme Centre`) est créé automatiquement par branche ; le sous-menu **Parent** est masqué dans Utilisateurs.

---

## 1. État actuel (après implémentation)

| Élément | Situation |
|--------|-----------|
| Modèle | `BranchRegistrationInfo` lié à `Branch` (+ `SchoolYear` optionnel) |
| Admin | **Parametres ecole** → Inscription publique |
| Formulaire public | Panneau école (frais / conditions / rentrée) après sélection |
| Consentement | Lecture conditions obligatoire si fiche publiée + `termsAcceptedAt` |

---

## 2. Objectifs produit

1. **Après sélection de l’école**, permettre de **lire les conditions d’inscription** (dynamiques par branche).
2. **Signaler clairement** quand / combien payer le **frais d’inscription**.
3. Afficher le **programme de rentrée scolaire** de l’école (année en cours).
4. **Améliorer le design** de la page publique (shadcn).
5. Admin org : **créer / éditer / publier** ces infos (Zod + react-hook-form).

---

## 3. Architecture livrée

### Modèle `BranchRegistrationInfo`

Voir `prisma/schema.prisma` — migration `20260721010000_add_branch_registration_info`.

`RegistrationRequest` : champs `termsAcceptedAt`, `termsInfoId`.

### Admin

- **Emplacement principal :** Parametres de l'ecole  
  `.../branches/[branchId]/settings/inscription-publique`
- Hub org (liens vers chaque ecole) :  
  `.../organizations/[organizationId]/inscription-publique`  
  (plus de carte sur l'accueil org — le 404 venait d'un mauvais niveau / droits)

| Zone | Fichiers |
|------|----------|
| Schema | `prisma/schema.prisma`, migration |
| Types | `lib/registration-public-info.ts` |
| Settings branche | `settings/inscription-publique/*` |
| Public | `student-registration-form.tsx`, `school-registration-panel.tsx` |

---

## 6. Comment tester

1. Ecole → **Parametres** → **Inscription publique**
2. Remplir conditions / frais / programme, cocher **Publier**
3. Ouvrir `/inscription-eleve`, selectionner l'ecole
4. Lire les conditions, completer le wizard, envoyer
