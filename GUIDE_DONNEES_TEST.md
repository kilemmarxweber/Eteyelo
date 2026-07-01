# 🎓 Guide des Données de Test - ETEYELO

## 🚀 Démarrage Rapide

### Installation des dépendances
```bash
pnpm install
```

### Démonstration rapide (recommandé pour commencer)
```bash
pnpm run seed:demo
```

### Initialisation complète
```bash
pnpm run seed:all
```

## 📋 Commandes Disponibles

| Commande | Description |
|----------|-------------|
| `pnpm run seed:demo` | Démonstration rapide avec données minimales |
| `pnpm run seed:all` | Initialisation complète de toutes les données |
| `pnpm run seed:clear` | Suppression de toutes les données |
| `pnpm run seed:help` | Aide détaillée |
| `pnpm run seed:list` | Liste des scripts disponibles |

## 🔑 Comptes de Test Créés

### Administrateur
- **Utilisateur**: `admin`
- **Mot de passe**: `Admin123!`
- **Rôle**: Administration complète

### Enseignants (6 comptes)
- **Format**: `prof.[nom]`
- **Mot de passe**: `Password123!`
- **Exemples**:
  - `prof.mukendi` (Mathématiques)
  - `prof.mbuyi` (Français)
  - `prof.tshimanga` (Physique)

### Parents (5 comptes)
- **Format**: `parent.[nom]`
- **Mot de passe**: `Password123!`
- **Exemples**:
  - `parent.kasongo`
  - `parent.kalombo`

### Étudiants (10 comptes)
- **Format**: `eleve.[nom].[prenom]`
- **Mot de passe**: `Student123!`
- **Exemples**:
  - `eleve.kasongo.junior`
  - `eleve.kalombo.grâce`

## 📊 Données Générées

### Structure Académique
- **3 Années scolaires**: 2023-2024, 2024-2025 (courante), 2025-2026
- **7 Sections**: Général, Bio-Chimie, Math-Physique, Commercial, Technique, Lettres, Pédagogique
- **15 Options**: Filières spécialisées dans chaque section
- **17 Classes**: 5ème à 7ème années dans différentes options
- **31 Cours**: Matières adaptées aux filières

### Relations Complètes
- **Inscriptions**: Étudiants inscrits dans des classes par année
- **Enseignements**: Enseignants assignés aux cours et classes
- **Horaires**: Planning détaillé des cours
- **Frais scolaires**: Différents types de frais par classe

## 🎯 Utilisation par Scénario

### Développement Frontend
```bash
# Données minimales pour tester l'interface
pnpm run seed:demo
```

### Test Complet du Système
```bash
# Toutes les données avec relations
pnpm run seed:all
```

### Reset pour Nouveaux Tests
```bash
# Nettoyer et réinitialiser
pnpm run seed:clear
pnpm run seed:all
```

### Données Spécifiques
```bash
# Seulement utilisateurs et classes
pnpm run seed --init users,admin,classes

# Seulement les frais
pnpm run seed --init typeFrais,frais
```

## 🔧 Personnalisation

### Modifier les Données
1. Ouvrir `prisma/seeds/init[Entité].ts`
2. Modifier les tableaux de données
3. Relancer le script spécifique

### Ajouter de Nouvelles Données
1. Créer un nouveau fichier `initNouveau.ts`
2. Suivre la structure des fichiers existants
3. Ajouter dans `seedData.ts`

## 🚨 Avertissements

- ⚠️ **Base de Données**: Utilisez uniquement sur des environnements de développement
- ⚠️ **Sauvegarde**: Sauvegardez avant d'utiliser `--clear`
- ⚠️ **Production**: Ne jamais exécuter en production

## 📁 Structure du Système

```
prisma/seeds/
├── README.md              # Documentation détaillée
├── seedData.ts            # Script central
├── quickDemo.ts           # Démonstration rapide
├── initSchoolYears.ts     # Années scolaires
├── initSections.ts        # Sections
├── initOptions.ts         # Options/filières
├── initClasses.ts         # Classes
├── initCours.ts           # Cours/matières
├── initUsers.ts           # Utilisateurs
├── initAdmin.ts           # Administrateur
├── initTeachers.ts        # Enseignants
├── initParents.ts         # Parents
├── initStudents.ts        # Étudiants
├── initClassEnrollments.ts # Inscriptions
├── initTeaching.ts        # Enseignements
├── initSchedules.ts       # Horaires
├── initTypeFrais.ts       # Types de frais
└── initFrais.ts           # Frais scolaires
```

## 🆘 Support

### Erreurs Communes

**Erreur de clé étrangère**:
```bash
pnpm run seed:clear
pnpm run seed:all
```

**Données partielles**:
```bash
pnpm run seed --clear-specific [entité]
pnpm run seed --init [entité]
```

**Mot de passe oublié**:
- Tous les mots de passe sont documentés ci-dessus
- Utilisez le format approprié selon le type d'utilisateur

### Logs et Debugging
- Les scripts affichent des logs détaillés
- Vérifiez les erreurs de contraintes de base de données
- Consultez la documentation Prisma pour les relations

---

**🎯 Astuce**: Commencez toujours par `pnpm run seed:demo` pour tester rapidement, puis utilisez `pnpm run seed:all` pour un environnement complet. 