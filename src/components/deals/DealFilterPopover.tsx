import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useUserRole } from "@/hooks/useUserRole";
import type { DateRange } from "react-day-picker";

export interface DealFilters {
  valueMin?: number;
  valueMax?: number;
  createdDateRange?: DateRange;
  expectedCloseDateRange?: DateRange;
  activityStatus?: string;
  leadSource: string[];
  assignedTo?: string[];
  search: string;
}

interface DealFilterPopoverProps {
  filters: DealFilters;
  onFiltersChange: (filters: DealFilters) => void;
}

const LEAD_SOURCES = [
  { value: "kiwify", label: "Kiwify" },
  { value: "kiwify_upsell", label: "Kiwify Upsell" },
  { value: "manual", label: "Manual" },
  { value: "webchat", label: "Web Chat" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "indicacao", label: "Indicação" },
];

const ACTIVITY_STATUS = [
  { value: "no_tasks", label: "Sem tarefas agendadas" },
  { value: "overdue", label: "Com tarefas atrasadas" },
  { value: "on_track", label: "Em dia" },
];

export default function DealFilterPopover({ filters, onFiltersChange }: DealFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: salesReps } = useSalesReps();
  const { isAdmin, isManager, isGeneralManager } = useUserRole();
  const canFilterByRep = isAdmin || isManager || isGeneralManager;
  const activeFiltersCount = [
    filters.valueMin !== undefined ? 1 : 0,
    filters.valueMax !== undefined ? 1 : 0,
    filters.createdDateRange?.from ? 1 : 0,
    filters.expectedCloseDateRange?.from ? 1 : 0,
    filters.activityStatus ? 1 : 0,
    filters.leadSource.length,
    filters.assignedTo?.length || 0,
  ].reduce((a, b) => a + b, 0);

  const handleRepToggle = (repId: string) => {
    const currentReps = filters.assignedTo || [];
    const newReps = currentReps.includes(repId)
      ? currentReps.filter(r => r !== repId)
      : [...currentReps, repId];
    onFiltersChange({ ...filters, assignedTo: newReps });
  };

  const handleSourceToggle = (source: string) => {
    const newSources = filters.leadSource.includes(source)
      ? filters.leadSource.filter(s => s !== source)
      : [...filters.leadSource, source];
    onFiltersChange({ ...filters, leadSource: newSources });
  };

  const clearFilters = () => {
    onFiltersChange({
      valueMin: undefined,
      valueMax: undefined,
      createdDateRange: undefined,
      expectedCloseDateRange: undefined,
      activityStatus: undefined,
      leadSource: [],
      assignedTo: [],
      search: filters.search,
    });
  };

  const formatCurrency = (value: string) => {
    const num = value.replace(/\D/g, "");
    if (!num) return "";
    return new Intl.NumberFormat("pt-BR").format(parseInt(num));
  };

  const parseCurrency = (value: string): number | undefined => {
    const num = value.replace(/\D/g, "");
    return num ? parseInt(num) : undefined;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros Avançados
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-4" align="start">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground">Filtros de Negócios</h4>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Value Range */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Valor (R$)</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Mínimo"
                  value={filters.valueMin !== undefined ? formatCurrency(filters.valueMin.toString()) : ""}
                  onChange={(e) => onFiltersChange({ 
                    ...filters, 
                    valueMin: parseCurrency(e.target.value) 
                  })}
                />
              </div>
              <span className="flex items-center text-muted-foreground">até</span>
              <div className="flex-1">
                <Input
                  placeholder="Máximo"
                  value={filters.valueMax !== undefined ? formatCurrency(filters.valueMax.toString()) : ""}
                  onChange={(e) => onFiltersChange({ 
                    ...filters, 
                    valueMax: parseCurrency(e.target.value) 
                  })}
                />
              </div>
            </div>
          </div>

          {/* Created Date Range */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Data de Criação</Label>
            <DatePickerWithRange
              date={filters.createdDateRange}
              onDateChange={(date) => onFiltersChange({ ...filters, createdDateRange: date })}
            />
          </div>

          {/* Expected Close Date Range */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Data Prevista de Fechamento</Label>
            <DatePickerWithRange
              date={filters.expectedCloseDateRange}
              onDateChange={(date) => onFiltersChange({ ...filters, expectedCloseDateRange: date })}
            />
          </div>

          {/* Activity Status */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Status de Atividade</Label>
            <Select
              value={filters.activityStatus || "all"}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                activityStatus: v === "all" ? undefined : v 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ACTIVITY_STATUS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead Source */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Origem</Label>
            <div className="grid grid-cols-2 gap-2">
              {LEAD_SOURCES.map((source) => (
                <div key={source.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`source-${source.value}`}
                    checked={filters.leadSource.includes(source.value)}
                    onCheckedChange={() => handleSourceToggle(source.value)}
                  />
                  <label
                    htmlFor={`source-${source.value}`}
                    className="text-sm cursor-pointer"
                  >
                    {source.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned To - Only for managers - Multi-select with checkboxes */}
          {canFilterByRep && salesReps && salesReps.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Responsável</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {salesReps.map((rep) => (
                  <div key={rep.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`rep-${rep.id}`}
                      checked={(filters.assignedTo || []).includes(rep.id)}
                      onCheckedChange={() => handleRepToggle(rep.id)}
                    />
                    <label
                      htmlFor={`rep-${rep.id}`}
                      className="text-sm cursor-pointer truncate"
                    >
                      {rep.full_name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
