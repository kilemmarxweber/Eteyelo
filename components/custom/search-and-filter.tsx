"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown,
  SlidersHorizontal,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Table as TanstackTable } from "@tanstack/react-table";

interface SearchAndFilterProps<TData> {
  table: TanstackTable<TData>;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: {
    id: string;
    label: string;
    options: { label: string; value: string; count?: number }[];
  }[];
  onFilterChange?: (filterId: string, value: string) => void;
  onClearAll?: () => void;
  className?: string;
  isMobile?: boolean;
}

export function SearchAndFilter<TData>({
  table,
  searchPlaceholder = "Rechercher...",
  searchValue = "",
  onSearchChange,
  filters = [],
  onFilterChange,
  onClearAll,
  className,
  isMobile = false
}: SearchAndFilterProps<TData>) {
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState<Record<string, string[]>>({});

  // Gestion des filtres
  const handleFilterChange = (filterId: string, value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterId]: prev[filterId]?.includes(value)
        ? prev[filterId].filter(v => v !== value)
        : [...(prev[filterId] || []), value]
    }));
    
    onFilterChange?.(filterId, value);
  };

  const clearFilter = (filterId: string) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterId];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    onClearAll?.();
  };

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Barre de recherche mobile */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className={cn(
              "pl-10 pr-4 h-10",
              isSearchFocused && "ring-2 ring-primary/20"
            )}
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => onSearchChange?.("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filtres mobiles */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <DropdownMenu key={filter.id}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={activeFilters[filter.id]?.length ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                  >
                    <Filter className="mr-1 h-3 w-3" />
                    {filter.label}
                    {activeFilters[filter.id]?.length > 0 && (
                      <span className="ml-1 bg-background text-foreground rounded-full px-1.5 py-0.5 text-xs">
                        {activeFilters[filter.id].length}
                      </span>
                    )}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {filter.options.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={activeFilters[filter.id]?.includes(option.value) || false}
                      onCheckedChange={() => handleFilterChange(filter.id, option.value)}
                    >
                      <span className="flex-1">{option.label}</span>
                      {option.count !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          ({option.count})
                        </span>
                      )}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 text-destructive hover:text-destructive"
              >
                <X className="mr-1 h-3 w-3" />
                Effacer
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* Barre de recherche desktop */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className={cn(
            "pl-10 pr-4",
            isSearchFocused && "ring-2 ring-primary/20"
          )}
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => onSearchChange?.("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtres desktop */}
      {filters.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="sm"
              className="h-9"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <span className="ml-2 bg-background text-foreground rounded-full px-1.5 py-0.5 text-xs">
                  {Object.values(activeFilters).flat().length}
                </span>
              )}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filtres actifs</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {filters.map((filter) => (
              <div key={filter.id}>
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  {filter.label}
                </DropdownMenuLabel>
                {filter.options.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={activeFilters[filter.id]?.includes(option.value) || false}
                    onCheckedChange={() => handleFilterChange(filter.id, option.value)}
                  >
                    <span className="flex-1">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        ({option.count})
                      </span>
                    )}
                  </DropdownMenuCheckboxItem>
                ))}
                {activeFilters[filter.id]?.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearFilter(filter.id)}
                    className="w-full justify-start text-xs text-destructive hover:text-destructive"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Effacer {filter.label}
                  </Button>
                )}
                <DropdownMenuSeparator />
              </div>
            ))}
            
            {hasActiveFilters && (
              <>
                <DropdownMenuSeparator />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="w-full justify-start text-xs text-destructive hover:text-destructive"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Effacer tous les filtres
                </Button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
} 