"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Edit, 
  Trash2
} from "lucide-react";
import { TableSkeleton } from "./table-skeleton";
import { EmptyTableState } from "./empty-table-state";

interface ResponsiveDataTableProps<TData> {
  data: TData[];
  columns: {
    key: string;
    header: string;
    cell: (item: TData) => React.ReactNode;
  }[];
  cardConfig: {
    title: (item: TData) => string;
    subtitle: (item: TData) => string;
    details: (item: TData) => Array<{
      label: string;
      value: React.ReactNode;
    }>;
    actions: (item: TData) => Array<{
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      onClick: () => void;
      variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    }>;
  };
  loading?: boolean;
  emptyMessage?: string;
  searchTerm?: string;
}

export function ResponsiveDataTable<TData>({
  data,
  columns,
  cardConfig,
  loading = false,
  emptyMessage = "Aucune donnée trouvée",
  searchTerm = ""
}: ResponsiveDataTableProps<TData>) {
  const [isMobile, setIsMobile] = React.useState(false);

  // Détection responsive
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading) {
    return <TableSkeleton />;
  }

  if (data.length === 0) {
    return <EmptyTableState message={emptyMessage} searchTerm={searchTerm} />;
  }

  // Vue mobile - Cards
  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((item, index) => (
          <Card key={index} className="transition-all hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-semibold truncate">
                    {cardConfig.title(item)}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cardConfig.subtitle(item)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {cardConfig.actions(item).map((action, actionIndex) => (
                      <DropdownMenuItem 
                        key={actionIndex}
                        onClick={action.onClick}
                        className={action.variant === "destructive" ? "text-destructive" : ""}
                      >
                        <action.icon className="mr-2 h-4 w-4" />
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {cardConfig.details(item).map((detail, detailIndex) => (
                  <div key={detailIndex} className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      {detail.label}:
                    </span>
                    <span className="text-sm text-right flex-1 ml-2">
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 mt-4 pt-3 border-t">
                {cardConfig.actions(item).map((action, actionIndex) => (
                  <Button
                    key={actionIndex}
                    variant={action.variant || "outline"}
                    size="sm"
                    onClick={action.onClick}
                    className="flex-1"
                  >
                    <action.icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Vue desktop - Tableau
  return (
    <div className="rounded-md border">
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              {columns.map((column, index) => (
                <th key={index} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {data.map((item, index) => (
              <tr key={index} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                {columns.map((column, columnIndex) => (
                  <td key={columnIndex} className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                    {column.cell(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 