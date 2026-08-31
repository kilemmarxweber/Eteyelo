"use client";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface SearchAndFilterProps {
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: Array<{ value: string; label: string }>;
  showSearch?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchAndFilter({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  filterPlaceholder = "Filtrer par...",
  filterValue,
  onFilterChange,
  filterOptions = [],
  showSearch = true,
  autoFocus = false,
}: SearchAndFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {showSearch && onSearchChange && (
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <SearchInput
            placeholder={searchPlaceholder}
            value={searchTerm ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus={autoFocus}
            className="h-9 pl-10 pr-10 text-sm"
          />
          {searchTerm ? (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => onSearchChange("")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      )}

      {filterOptions.length > 0 && onFilterChange ? (
        <Select value={filterValue} onValueChange={onFilterChange}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[200px]">
            <SelectValue placeholder={filterPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
