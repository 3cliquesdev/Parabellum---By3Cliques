import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSavedDealFilters, useDeleteSavedFilter } from "@/hooks/useSavedDealFilters";
import type { DealFilters } from "@/hooks/useDeals";
import { Bookmark, Trash2, ChevronDown } from "lucide-react";

interface SavedFiltersDropdownProps {
  onApplyFilter: (filters: DealFilters) => void;
}

export function SavedFiltersDropdown({ onApplyFilter }: SavedFiltersDropdownProps) {
  const { data: savedFilters, isLoading } = useSavedDealFilters();
  const deleteFilter = useDeleteSavedFilter();

  if (isLoading || !savedFilters || savedFilters.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bookmark className="h-4 w-4" />
          Filtros Salvos
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Meus Filtros</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {savedFilters.map((filter) => (
          <DropdownMenuItem
            key={filter.id}
            className="flex items-center justify-between cursor-pointer"
          >
            <span
              className="flex-1 truncate"
              onClick={() => onApplyFilter(filter.filters)}
            >
              {filter.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteFilter.mutate(filter.id);
              }}
              className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
