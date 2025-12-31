import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, RotateCcw, Save, Sparkles } from "lucide-react";
import { StatusMultiSelect } from "./filters/StatusMultiSelect";
import { StageMultiSelect } from "./filters/StageMultiSelect";
import { ValuePresetButtons } from "./filters/ValuePresetButtons";
import { ProbabilitySlider } from "./filters/ProbabilitySlider";
import { DatePresetButtons } from "./filters/DatePresetButtons";
import { SourceMultiSelect } from "./filters/SourceMultiSelect";
import { AssignedToMultiSelect } from "./filters/AssignedToMultiSelect";
import { SaveFilterDialog } from "./filters/SaveFilterDialog";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DealFilters } from "@/hooks/useDeals";
import { useUserRole } from "@/hooks/useUserRole";

interface AdvancedDealFiltersModalProps {
  pipelineId: string;
  filters: DealFilters;
  onFiltersChange: (filters: DealFilters) => void;
  activeFilterCount: number;
}

export function AdvancedDealFiltersModal({
  pipelineId,
  filters,
  onFiltersChange,
  activeFilterCount,
}: AdvancedDealFiltersModalProps) {
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<DealFilters>(filters);
  const { role } = useUserRole();
  const isManagerOrAdmin = role === "admin" || role === "manager";

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalFilters(filters);
    }
    setOpen(isOpen);
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleClear = () => {
    const clearedFilters: DealFilters = {
      search: "",
      leadSource: [],
      assignedTo: [],
      status: [],
      stageIds: [],
      sortBy: "created_at_desc",
    };
    setLocalFilters(clearedFilters);
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const parseCurrency = (value: string): number | undefined => {
    const cleaned = value.replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : undefined;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Filtros Avançados
            </DialogTitle>
            <DialogDescription>
              Configure filtros detalhados para encontrar exatamente os negócios que procura.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] px-6">
            <div className="space-y-6 py-4">
              {/* STATUS & ETAPA */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Status & Etapa
                </h3>
                <div className="space-y-3 pl-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <StatusMultiSelect
                      selected={localFilters.status || []}
                      onChange={(status) => setLocalFilters({ ...localFilters, status })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Etapa do Pipeline</Label>
                    <StageMultiSelect
                      pipelineId={pipelineId}
                      selected={localFilters.stageIds || []}
                      onChange={(stageIds) => setLocalFilters({ ...localFilters, stageIds })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* VALORES */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Valores
                </h3>
                <div className="space-y-3 pl-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Faixa de Valor</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Mínimo"
                        value={formatCurrency(localFilters.valueMin)}
                        onChange={(e) =>
                          setLocalFilters({ ...localFilters, valueMin: parseCurrency(e.target.value) })
                        }
                        className="w-32"
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        placeholder="Máximo"
                        value={formatCurrency(localFilters.valueMax)}
                        onChange={(e) =>
                          setLocalFilters({ ...localFilters, valueMax: parseCurrency(e.target.value) })
                        }
                        className="w-32"
                      />
                    </div>
                    <ValuePresetButtons
                      valueMin={localFilters.valueMin}
                      valueMax={localFilters.valueMax}
                      onSelect={(min, max) => setLocalFilters({ ...localFilters, valueMin: min, valueMax: max })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Probabilidade de Fechamento</Label>
                    <ProbabilitySlider
                      min={localFilters.probabilityMin}
                      max={localFilters.probabilityMax}
                      onChange={(min, max) =>
                        setLocalFilters({ ...localFilters, probabilityMin: min, probabilityMax: max })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* DATAS */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Datas
                </h3>
                <div className="space-y-4 pl-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data de Criação</Label>
                    <DatePresetButtons
                      value={localFilters.createdDateRange}
                      onChange={(range) => setLocalFilters({ ...localFilters, createdDateRange: range })}
                      mode="past"
                    />
                    <DatePickerWithRange
                      date={localFilters.createdDateRange}
                      onDateChange={(range) => setLocalFilters({ ...localFilters, createdDateRange: range })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Previsão de Fechamento</Label>
                    <DatePresetButtons
                      value={localFilters.expectedCloseDateRange}
                      onChange={(range) => setLocalFilters({ ...localFilters, expectedCloseDateRange: range })}
                      mode="future"
                    />
                    <DatePickerWithRange
                      date={localFilters.expectedCloseDateRange}
                      onDateChange={(range) => setLocalFilters({ ...localFilters, expectedCloseDateRange: range })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* PESSOAS & ORIGEM */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Pessoas & Origem
                </h3>
                <div className="space-y-4 pl-4">
                  {isManagerOrAdmin && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Responsável</Label>
                      <AssignedToMultiSelect
                        selected={localFilters.assignedTo || []}
                        onChange={(assignedTo) => setLocalFilters({ ...localFilters, assignedTo })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Origem do Lead</Label>
                    <SourceMultiSelect
                      selected={localFilters.leadSource}
                      onChange={(leadSource) => setLocalFilters({ ...localFilters, leadSource })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
            <div className="flex w-full items-center justify-between">
              <Button variant="ghost" onClick={handleClear} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Limpar Tudo
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSaveDialogOpen(true)} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Filtro
                </Button>
                <Button onClick={handleApply} className="gap-2">
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveFilterDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        filters={localFilters}
      />
    </>
  );
}
