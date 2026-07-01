"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Database,
  Users,
  BookOpen,
  GraduationCap,
  DollarSign,
  Settings,
  FileText,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyTableStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  isMobile?: boolean;
  className?: string;
  type?:
    | "default"
    | "search"
    | "data"
    | "users"
    | "courses"
    | "students"
    | "finance"
    | "settings"
    | "documents"
    | "calendar";
}

const getDefaultContent = (type?: string) => {
  switch (type) {
    case "search":
      return {
        icon: <Search className="h-12 w-12 text-muted-foreground" />,
        title: "Aucun résultat trouvé",
        description:
          "Essayez de modifier vos critères de recherche ou vos filtres.",
        actionLabel: "Effacer les filtres",
      };
    case "users":
      return {
        icon: <Users className="h-12 w-12 text-muted-foreground" />,
        title: "Aucun utilisateur",
        description:
          "Commencez par ajouter votre premier utilisateur au système.",
        actionLabel: "Ajouter un utilisateur",
      };
    case "courses":
      return {
        icon: <BookOpen className="h-12 w-12 text-muted-foreground" />,
        title: "Aucun cours",
        description:
          "Créez votre premier cours pour commencer la gestion académique.",
        actionLabel: "Créer un cours",
      };
    case "students":
      return {
        icon: <GraduationCap className="h-12 w-12 text-muted-foreground" />,
        title: "Aucun élève",
        description:
          "Ajoutez vos premiers élèves pour commencer la gestion scolaire.",
        actionLabel: "Ajouter un élève",
      };
    case "finance":
      return {
        icon: <DollarSign className="h-12 w-12 text-muted-foreground" />,
        title: "Aucune donnée financière",
        description: "Commencez par configurer vos frais et paiements.",
        actionLabel: "Configurer les frais",
      };
    case "settings":
      return {
        icon: <Settings className="h-12 w-12 text-muted-foreground" />,
        title: "Aucun paramètre",
        description: "Configurez les paramètres de votre établissement.",
        actionLabel: "Configurer",
      };
    case "documents":
      return {
        icon: <FileText className="h-12 w-12 text-muted-foreground" />,
        title: "Aucun document",
        description: "Ajoutez vos premiers documents au système.",
        actionLabel: "Ajouter un document",
      };
    case "calendar":
      return {
        icon: <Calendar className="h-12 w-12 text-muted-foreground" />,
        title: "Aucun événement",
        description: "Planifiez vos premiers événements et horaires.",
        actionLabel: "Ajouter un événement",
      };
    case "data":
      return {
        icon: <Database className="h-12 w-12 text-muted-foreground" />,
        title: "Aucune donnée",
        description: "Il n'y a actuellement aucune donnée à afficher.",
        actionLabel: "Ajouter des données",
      };
    default:
      return {
        icon: <Database className="h-12 w-12 text-muted-foreground" />,
        title: "Aucune donnée",
        description: "Il n'y a actuellement aucune donnée à afficher.",
        actionLabel: "Ajouter",
      };
  }
};

export function EmptyTableState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  isMobile = false,
  className,
  type = "default",
}: EmptyTableStateProps) {
  const defaultContent = getDefaultContent(type);

  const finalTitle = title || defaultContent.title;
  const finalDescription = description || defaultContent.description;
  const finalIcon = icon || defaultContent.icon;
  const finalActionLabel = actionLabel || defaultContent.actionLabel;

  if (isMobile) {
    return (
      <Card className={cn("animate-in fade-in-50", className)}>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4">{finalIcon}</div>
          <h3 className="text-lg font-semibold mb-2">{finalTitle}</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {finalDescription}
          </p>
          {onAction && (
            <Button onClick={onAction} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {finalActionLabel}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className,
      )}
    >
      <div className="mb-6">{finalIcon}</div>
      <h3 className="text-xl font-semibold mb-3">{finalTitle}</h3>
      <p className="text-muted-foreground mb-8 max-w-[700px]">
        {finalDescription}
      </p>
      {onAction && (
        <Button onClick={onAction} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          {finalActionLabel}
        </Button>
      )}
    </div>
  );
}

// Composants spécialisés pour différents types de données
export function EmptyUsersState(props: Omit<EmptyTableStateProps, "type">) {
  return <EmptyTableState {...props} type="users" />;
}

export function EmptyCoursesState(props: Omit<EmptyTableStateProps, "type">) {
  return <EmptyTableState {...props} type="courses" />;
}

export function EmptyStudentsState(props: Omit<EmptyTableStateProps, "type">) {
  return <EmptyTableState {...props} type="students" />;
}

export function EmptyFinanceState(props: Omit<EmptyTableStateProps, "type">) {
  return <EmptyTableState {...props} type="finance" />;
}

export function EmptySearchState(props: Omit<EmptyTableStateProps, "type">) {
  return <EmptyTableState {...props} type="search" />;
}
