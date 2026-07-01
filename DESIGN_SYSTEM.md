# 🎨 Design System Eteyelo

## Vue d'ensemble

Ce design system moderne et professionnel pour l'application de gestion scolaire Eteyelo offre :

- **Cohérence visuelle** : Palette de couleurs éducative et moderne
- **Responsive design** : Optimisé mobile/tablette/desktop
- **Composants modulaires** : Système de variantes avec class-variance-authority
- **Accessibilité** : Focus states et navigation clavier
- **Performance** : Animations fluides et optimisées

## 🎨 Palette de couleurs

### Couleurs principales
- **Primary** : `oklch(55% 0.18 264)` - Bleu éducatif moderne
- **Secondary** : `oklch(95% 0.01 264)` - Gris clair
- **Accent** : `oklch(92% 0.015 192)` - Vert éducation

### Couleurs de feedback
- **Success** : `oklch(60% 0.15 142)` - Vert succès
- **Warning** : `oklch(75% 0.18 85)` - Orange alerte  
- **Destructive** : `oklch(62% 0.22 25)` - Rouge erreur
- **Info** : `oklch(65% 0.15 220)` - Bleu information

## 🧩 Composants

### Button
Composant bouton avec animations et multiples variantes.

```tsx
import { Button } from "@/components/custom/button"

// Variantes disponibles
<Button variant="default">Défaut</Button>
<Button variant="destructive">Destructif</Button>
<Button variant="success">Succès</Button>
<Button variant="warning">Alerte</Button>
<Button variant="outline">Contour</Button>
<Button variant="ghost">Fantôme</Button>
<Button variant="gradient">Dégradé</Button>

// Tailles
<Button size="xs">Extra petit</Button>
<Button size="sm">Petit</Button>
<Button size="default">Défaut</Button>
<Button size="lg">Grand</Button>
<Button size="xl">Extra grand</Button>

// Avec icônes et loading
<Button loading leftSection={<Icon />}>
  Chargement...
</Button>
```

### Card
Composant carte flexible avec variantes et interactions.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

<Card variant="default" padding="default">
  <CardHeader>
    <CardTitle>Titre de la carte</CardTitle>
    <CardDescription>Description de la carte</CardDescription>
  </CardHeader>
  <CardContent>
    Contenu de la carte
  </CardContent>
  <CardFooter>
    Actions de la carte
  </CardFooter>
</Card>

// Variantes
<Card variant="elevated">Surélevée</Card>
<Card variant="outline">Contour</Card>
<Card variant="success">Succès</Card>
<Card variant="gradient" interactive>Dégradé interactif</Card>
```

### Input
Composant de saisie avec icônes et validation.

```tsx
import { Input } from "@/components/ui/input"
import { IconUser, IconSearch } from "@tabler/icons-react"

<Input 
  placeholder="Rechercher..." 
  startIcon={<IconSearch size={16} />}
/>

<Input 
  variant="filled"
  inputSize="lg"
  error={hasError}
  helperText="Texte d'aide ou erreur"
/>

// Variantes
<Input variant="default" />
<Input variant="filled" />
<Input variant="flushed" />
<Input variant="success" />
<Input variant="destructive" />
```

### Badge
Étiquettes et indicateurs de statut.

```tsx
import { Badge } from "@/components/ui/badge"

<Badge variant="default">Défaut</Badge>
<Badge variant="success" size="lg">Succès</Badge>
<Badge variant="outline-primary" dot>Avec point</Badge>
<Badge variant="gradient" icon={<Icon />}>Avec icône</Badge>

// Formes
<Badge shape="pill">Pilule</Badge>
<Badge shape="square">Carré</Badge>
```

### Grid
Système de grille responsive.

```tsx
import { Grid, GridItem } from "@/components/ui/grid"

<Grid cols={3} gap="lg">
  <GridItem colSpan={2}>Élément large</GridItem>
  <GridItem>Élément normal</GridItem>
  <GridItem colSpan="full">Élément pleine largeur</GridItem>
</Grid>

// Grille auto-adaptative
<Grid cols="auto" gap="md">
  {items.map(item => (
    <GridItem key={item.id}>{item.content}</GridItem>
  ))}
</Grid>
```

### PageHeader
En-tête de page standardisé.

```tsx
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/custom/button"
import { Badge } from "@/components/ui/badge"

<PageHeader
  title="Gestion des élèves"
  description="Gérer les informations des élèves et leurs inscriptions"
  badge={<Badge variant="success">124 élèves</Badge>}
  actions={
    <Button variant="default">
      Ajouter un élève
    </Button>
  }
/>
```

## 📱 Responsive Design

### Breakpoints
- **xs** : < 640px (mobile)
- **sm** : 640px+ (mobile large)
- **md** : 768px+ (tablette)
- **lg** : 1024px+ (desktop)
- **xl** : 1280px+ (desktop large)
- **2xl** : 1536px+ (desktop très large)

### Stratégie Mobile-First
Tous les composants sont conçus mobile-first avec des améliorations progressives.

```tsx
// Exemple de grid responsive
<Grid cols={1} gap="sm" className="md:cols-2 lg:cols-3">
  {/* Contenu */}
</Grid>
```

## 🎭 Animations et Transitions

### Classes d'animation globales
- `.animate-fade-in` : Apparition en fondu
- `.animate-slide-in` : Glissement depuis la gauche

### Durées de transition
- **Fast** : 150ms - Feedback immédiat
- **Default** : 200ms - Transitions standards  
- **Slow** : 300ms - Animations complexes

## 📐 Espacement

### Système d'espacement
- **xs** : 0.25rem (4px)
- **sm** : 0.5rem (8px)
- **md** : 1rem (16px)
- **lg** : 1.5rem (24px)
- **xl** : 2rem (32px)
- **2xl** : 3rem (48px)

### Radius
- **xs** : `calc(var(--radius) - 6px)`
- **sm** : `calc(var(--radius) - 4px)`
- **md** : `calc(var(--radius) - 2px)`
- **lg** : `var(--radius)` (12px)
- **xl** : `calc(var(--radius) + 4px)`
- **2xl** : `calc(var(--radius) + 8px)`

## 🔧 Utilisation

### Import des composants
```tsx
// Composants de base
import { Button } from "@/components/custom/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

// Composants de layout
import { Grid, GridItem } from "@/components/ui/grid"
import { PageHeader } from "@/components/ui/page-header"
```

### Patterns recommandés

#### Page de liste
```tsx
export default function StudentsPage() {
  return (
    <Layout>
      <LayoutBody>
        <PageHeader
          title="Liste des élèves"
          description="Gérer les informations des élèves"
          actions={<Button>Ajouter</Button>}
        />
        
        <Card>
          <DataTable data={students} columns={columns} />
        </Card>
      </LayoutBody>
    </Layout>
  )
}
```

#### Formulaire
```tsx
export default function StudentForm() {
  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <CardTitle>Nouvel élève</CardTitle>
        <CardDescription>Remplir les informations</CardDescription>
      </CardHeader>
      
      <CardContent>
        <Grid cols={2} gap="md">
          <Input placeholder="Prénom" />
          <Input placeholder="Nom" />
          <Input placeholder="Email" type="email" />
          <Input placeholder="Téléphone" />
        </Grid>
      </CardContent>
      
      <CardFooter>
        <Button variant="outline">Annuler</Button>
        <Button>Enregistrer</Button>
      </CardFooter>
    </Card>
  )
}
```

## 🎯 Bonnes pratiques

### Couleurs
- Utiliser `primary` pour les actions principales
- `success/warning/destructive` pour les états
- `muted` pour les textes secondaires

### Espacement
- Préférer les classes Tailwind aux styles inline
- Utiliser le système de grille pour les layouts
- Respecter la hiérarchie d'espacement

### Accessibilité
- Tous les composants incluent les états focus
- Utiliser les attributs ARIA appropriés
- Respecter les contrastes de couleur

### Performance
- Composants lazy-loadés quand possible
- Animations optimisées CSS
- Images optimisées avec Next.js

## 🚀 Migration

Pour migrer les pages existantes :

1. Remplacer les Button actuels par le nouveau composant
2. Utiliser PageHeader pour standardiser les en-têtes
3. Migrer vers le système de Grid responsive
4. Appliquer les nouvelles variantes de Card
5. Utiliser les nouveaux Input avec validation

## 📚 Ressources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Components](https://www.radix-ui.com/)
- [Class Variance Authority](https://cva.style/)
- [Lucide Icons](https://lucide.dev/)

---

*Design System créé pour Eteyelo - Application de gestion scolaire moderne et professionnelle*
