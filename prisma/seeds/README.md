# 🎓 Système de Données de Test pour ETEYELO

Ce dossier contient un système complet de génération de données de test pour l'application de gestion scolaire ETEYELO.

## 🗂️ Structure des Fichiers

```
prisma/seeds/
├── README.md                    # Ce fichier
├── seedData.ts                  # Script central d'orchestration
├── initSchoolYears.ts          # Années scolaires
├── initSections.ts             # Sections scolaires
├── initOptions.ts              # Options/filières
├── initCreneaux.ts            # Créneaux horaires
├── initClasses.ts             # Classes
├── initCours.ts               # Cours/matières
├── initUsers.ts               # Utilisateurs de base
├── initAdmin.ts               # Administrateur
├── initTeachers.ts            # Enseignants
├── initParents.ts             # Parents
├── initStudents.ts            # Étudiants
├── initClassEnrollments.ts    # Inscriptions d'étudiants
├── initTeaching.ts            # Enseignements
├── initSchedules.ts           # Horaires de cours
├── initTypeFrais.ts           # Types de frais
└── initFrais.ts               # Frais scolaires
```

## 🚀 Utilisation

### Script NPM Principal

Ajoutez dans votre `package.json` :

```json
{
  "scripts": {
    "seed": "tsx prisma/seeds/seedData.ts",
    "seed:all": "tsx prisma/seeds/seedData.ts --all",
    "seed:clear": "tsx prisma/seeds/seedData.ts --clear",
    "seed:help": "tsx prisma/seeds/seedData.ts --help"
  }
}
```

### Commandes Disponibles

#### Initialisation complète

```bash
pnpm run seed --all
# ou
pnpm run seed:all
```

#### Suppression complète

```bash
pnpm run seed --clear
# ou
pnpm run seed:clear
```

#### Initialisation spécifique

```bash
pnpm run seed --init users,teachers,students
```

#### Suppression spécifique

```bash
pnpm run seed --clear-specific frais,schedules
```

#### Lister les scripts disponibles

```bash
pnpm run seed --list
```

#### Aide

````bash
pnpm run seed --help
# ou
pnpm run seed:help
```next

## 📋 Scripts Disponibles

1. **schoolYears** - Années scolaires (2023-2024, 2024-2025, 2025-2026)
2. **sections** - Sections (Général, Bio-Chimie, Math-Physique, Commercial, etc.)
3. **options** - Options/filières liées aux sections
4. **creneaux** - Créneaux horaires (matin, après-midi, journée complète, samedi)
5. **classes** - Classes liées aux options et créneaux
6. **cours** - Cours/matières (Français, Math, Sciences, etc.)
7. **users** - Utilisateurs de base (enseignants, parents, étudiants, admin)
8. **admin** - Administrateur système
9. **teachers** - Enseignants liés aux utilisateurs
10. **parents** - Parents liés aux utilisateurs
11. **students** - Étudiants liés aux utilisateurs et parents
12. **classEnrollments** - Inscriptions d'étudiants dans les classes
13. **teaching** - Enseignements (enseignant + cours + classe + année)
14. **schedules** - Horaires de cours
15. **typeFrais** - Types de frais (scolarité, inscription, examen, etc.)
16. **frais** - Frais scolaires liés aux classes

## 🔗 Ordre de Dépendances

L'ordre d'exécution est important à cause des relations entre les entités :

### Niveau 1 (Indépendants)
- `schoolYears`
- `sections`
- `cours`
- `users`

### Niveau 2 (Dépendent du niveau 1)
- `options` (dépend de `sections`)
- `creneaux`
- `admin` (dépend de `users`)
- `teachers` (dépend de `users`)
- `parents` (dépend de `users`)
- `typeFrais`

### Niveau 3 (Dépendent des niveaux précédents)
- `classes` (dépend de `options` et `creneaux`)
- `students` (dépend de `users` et `parents`)

### Niveau 4 (Dépendent des niveaux précédents)
- `classEnrollments` (dépend de `students`, `classes`, `schoolYears`)
- `teaching` (dépend de `teachers`, `cours`, `classes`, `schoolYears`)
- `frais` (dépend de `classes` et `typeFrais`)

### Niveau 5 (Dépendent de tout)
- `schedules` (dépend de `teaching`)

## 📊 Données Générées

### Utilisateurs et Rôles
- **1 Administrateur** : `admin` / `Admin123!`
- **6 Enseignants** : `prof.*` / `Password123!`
- **5 Parents** : `parent.*` / `Password123!`
- **10 Étudiants** : `eleve.*` / `Student123!`

### Structure Académique
- **3 Années scolaires** : 2023-2024, 2024-2025 (courante), 2025-2026
- **7 Sections** : Général, Bio-Chimie, Math-Physique, Commercial, Technique, Lettres, Pédagogique
- **15 Options** : Diverses filières liées aux sections
- **17 Classes** : De la 5ème à la 7ème dans différentes options
- **31 Cours** : Matières variées selon les filières

### Relations
- **Inscriptions** : Étudiants inscrits dans des classes par année
- **Enseignements** : Enseignants assignés à des cours dans des classes
- **Horaires** : Planning des cours avec jours et heures
- **Frais** : Frais de scolarité, inscription, laboratoire, etc.

## 🛠️ Personnalisation

### Ajouter de nouvelles données

1. Modifier les tableaux de données dans les fichiers `init*.ts`
2. Respecter les contraintes de clés étrangères
3. Tester avec des scripts spécifiques avant le déploiement complet

### Ajouter un nouveau script

1. Créer `initNouvelleEntite.ts`
2. Exporter `initNouvelleEntite()` et `clearNouvelleEntite()`
3. Ajouter dans `INIT_ORDER` de `seedData.ts`
4. Respecter l'ordre de dépendances

## ⚠️ Recommandations

1. **Toujours tester** sur une base de données de développement
2. **Sauvegarder** avant d'exécuter `--clear`
3. **Respecter l'ordre** de dépendances pour les scripts spécifiques
4. **Vérifier les données** après génération
5. **Adapter les montants** des frais selon le contexte local

## 🐛 Dépannage

### Erreurs de clés étrangères
```bash
# Supprimer dans l'ordre inverse
pnpm run seed --clear

# Réinitialiser dans le bon ordre
pnpm run seed --all
````

### Données partielles

```bash
# Supprimer et recréer des scripts spécifiques
pnpm run seed --clear-specific teaching,schedules
pnpm run seed --init teaching,schedules
```

### Problèmes de mot de passe

Les mots de passe sont hashés avec bcrypt. Pour les tests :

- Admin : `Admin123!`
- Enseignants : `Password123!`
- Étudiants : `Student123!`

## 📞 Support

Pour toute question ou problème, vérifiez :

1. Les logs d'erreur dans la console
2. Les contraintes de base de données
3. L'ordre d'exécution des scripts
4. La documentation Prisma pour les relations
