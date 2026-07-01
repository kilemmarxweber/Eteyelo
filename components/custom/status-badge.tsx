"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Pause, 
  Play,
  UserCheck,
  UserX,
  DollarSign,
  CreditCard,
  Calendar,
  BookOpen,
  GraduationCap,
  Settings
} from "lucide-react";

type StatusType = 
  | 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled' | 'draft'
  | 'paid' | 'unpaid' | 'overdue' | 'partial'
  | 'enrolled' | 'graduated' | 'suspended' | 'withdrawn'
  | 'published' | 'draft' | 'archived'
  | 'online' | 'offline' | 'maintenance'
  | 'success' | 'error' | 'warning' | 'info';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const getStatusConfig = (status: StatusType) => {
  const configs: Record<StatusType, {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon?: React.ReactNode;
    className?: string;
  }> = {
    // Statuts génériques
    active: {
      label: "Actif",
      variant: "default",
      icon: <CheckCircle className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    inactive: {
      label: "Inactif",
      variant: "secondary",
      icon: <XCircle className="h-3 w-3" />,
      className: "bg-gray-100 text-gray-800 border-gray-200"
    },
    pending: {
      label: "En attente",
      variant: "outline",
      icon: <Clock className="h-3 w-3" />,
      className: "bg-yellow-100 text-yellow-800 border-yellow-200"
    },
    completed: {
      label: "Terminé",
      variant: "default",
      icon: <CheckCircle className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    cancelled: {
      label: "Annulé",
      variant: "destructive",
      icon: <XCircle className="h-3 w-3" />,
      className: "bg-red-100 text-red-800 border-red-200"
    },
    draft: {
      label: "Brouillon",
      variant: "outline",
      icon: <AlertCircle className="h-3 w-3" />,
      className: "bg-gray-100 text-gray-800 border-gray-200"
    },

    // Statuts financiers
    paid: {
      label: "Payé",
      variant: "default",
      icon: <DollarSign className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    unpaid: {
      label: "Non payé",
      variant: "destructive",
      icon: <CreditCard className="h-3 w-3" />,
      className: "bg-red-100 text-red-800 border-red-200"
    },
    overdue: {
      label: "En retard",
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3" />,
      className: "bg-orange-100 text-orange-800 border-orange-200"
    },
    partial: {
      label: "Partiel",
      variant: "outline",
      icon: <DollarSign className="h-3 w-3" />,
      className: "bg-blue-100 text-blue-800 border-blue-200"
    },

    // Statuts étudiants
    enrolled: {
      label: "Inscrit",
      variant: "default",
      icon: <UserCheck className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    graduated: {
      label: "Diplômé",
      variant: "default",
      icon: <GraduationCap className="h-3 w-3" />,
      className: "bg-purple-100 text-purple-800 border-purple-200"
    },
    suspended: {
      label: "Suspendu",
      variant: "destructive",
      icon: <Pause className="h-3 w-3" />,
      className: "bg-red-100 text-red-800 border-red-200"
    },
    withdrawn: {
      label: "Retiré",
      variant: "secondary",
      icon: <UserX className="h-3 w-3" />,
      className: "bg-gray-100 text-gray-800 border-gray-200"
    },

    // Statuts de contenu
    published: {
      label: "Publié",
      variant: "default",
      icon: <BookOpen className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    archived: {
      label: "Archivé",
      variant: "secondary",
      icon: <Settings className="h-3 w-3" />,
      className: "bg-gray-100 text-gray-800 border-gray-200"
    },

    // Statuts système
    online: {
      label: "En ligne",
      variant: "default",
      icon: <CheckCircle className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    offline: {
      label: "Hors ligne",
      variant: "secondary",
      icon: <XCircle className="h-3 w-3" />,
      className: "bg-gray-100 text-gray-800 border-gray-200"
    },
    maintenance: {
      label: "Maintenance",
      variant: "outline",
      icon: <Settings className="h-3 w-3" />,
      className: "bg-yellow-100 text-yellow-800 border-yellow-200"
    },

    // Statuts de notification
    success: {
      label: "Succès",
      variant: "default",
      icon: <CheckCircle className="h-3 w-3" />,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    error: {
      label: "Erreur",
      variant: "destructive",
      icon: <XCircle className="h-3 w-3" />,
      className: "bg-red-100 text-red-800 border-red-200"
    },
    warning: {
      label: "Attention",
      variant: "outline",
      icon: <AlertCircle className="h-3 w-3" />,
      className: "bg-yellow-100 text-yellow-800 border-yellow-200"
    },
    info: {
      label: "Info",
      variant: "outline",
      icon: <AlertCircle className="h-3 w-3" />,
      className: "bg-blue-100 text-blue-800 border-blue-200"
    }
  };

  return configs[status] || configs.inactive;
};

export function StatusBadge({
  status,
  label,
  showIcon = true,
  size = 'md',
  className
}: StatusBadgeProps) {
  const config = getStatusConfig(status);
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base"
  };

  const iconSizeClasses = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-4 w-4"
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showIcon && config.icon && (
        <div className={cn("flex-shrink-0", iconSizeClasses[size])}>
          {config.icon}
        </div>
      )}
      <span>{label || config.label}</span>
    </Badge>
  );
}

// Composants spécialisés pour différents types de statuts
export function StudentStatusBadge({ status, ...props }: Omit<StatusBadgeProps, 'status'> & { status: 'enrolled' | 'graduated' | 'suspended' | 'withdrawn' }) {
  return <StatusBadge status={status} {...props} />;
}

export function PaymentStatusBadge({ status, ...props }: Omit<StatusBadgeProps, 'status'> & { status: 'paid' | 'unpaid' | 'overdue' | 'partial' }) {
  return <StatusBadge status={status} {...props} />;
}

export function SystemStatusBadge({ status, ...props }: Omit<StatusBadgeProps, 'status'> & { status: 'online' | 'offline' | 'maintenance' }) {
  return <StatusBadge status={status} {...props} />;
}

export function NotificationStatusBadge({ status, ...props }: Omit<StatusBadgeProps, 'status'> & { status: 'success' | 'error' | 'warning' | 'info' }) {
  return <StatusBadge status={status} {...props} />;
} 