import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateSavedFilter } from "@/hooks/useSavedDealFilters";
import type { DealFilters } from "@/hooks/useDeals";
import { Save } from "lucide-react";

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DealFilters;
}

export function SaveFilterDialog({ open, onOpenChange, filters }: SaveFilterDialogProps) {
  const [name, setName] = useState("");
  const createFilter = useCreateSavedFilter();

  const handleSave = () => {
    if (!name.trim()) return;
    
    createFilter.mutate(
      { name: name.trim(), filters },
      {
        onSuccess: () => {
          setName("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Salvar Filtro
          </DialogTitle>
          <DialogDescription>
            Dê um nome para este filtro e use-o rapidamente no futuro.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="filter-name">Nome do filtro</Label>
            <Input
              id="filter-name"
              placeholder="Ex: Meus Ganhos do Mês"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || createFilter.isPending}>
            {createFilter.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
