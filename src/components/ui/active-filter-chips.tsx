import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface FilterChip {
  key: string;
  label: string;
}

interface ActiveFilterChipsProps {
  chips: FilterChip[];
  onRemoveChip: (key: string) => void;
  onClearAll?: () => void;
}

export function ActiveFilterChips({ chips, onRemoveChip, onClearAll }: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pl-3 pr-1 py-1 cursor-pointer hover:bg-secondary/80"
        >
          {chip.label}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveChip(chip.key);
            }}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {chips.length > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          Limpar todos
        </Button>
      )}
    </div>
  );
}

// Helper to generate chips from Deal filters
export function generateDealFilterChips(
  filters: {
    valueMin?: number;
    valueMax?: number;
    createdDateRange?: { from?: Date; to?: Date };
    expectedCloseDateRange?: { from?: Date; to?: Date };
    closedDateRange?: { from?: Date; to?: Date };
    updatedDateRange?: { from?: Date; to?: Date };
    activityStatus?: string;
    leadSource: string[];
    assignedTo?: string[];
    status?: string[];
    stageIds?: string[];
    probabilityMin?: number;
    probabilityMax?: number;
  },
  salesReps?: { id: string; full_name: string }[]
): FilterChip[] {
  const chips: FilterChip[] = [];
  const formatCurrency = (v: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  const formatDate = (d: Date) => d.toLocaleDateString("pt-BR");

  if (filters.valueMin !== undefined && filters.valueMax !== undefined) {
    chips.push({ key: "value", label: `Valor: ${formatCurrency(filters.valueMin)} - ${formatCurrency(filters.valueMax)}` });
  } else if (filters.valueMin !== undefined) {
    chips.push({ key: "valueMin", label: `Valor ≥ ${formatCurrency(filters.valueMin)}` });
  } else if (filters.valueMax !== undefined) {
    chips.push({ key: "valueMax", label: `Valor ≤ ${formatCurrency(filters.valueMax)}` });
  }

  if (filters.createdDateRange?.from) {
    const label = filters.createdDateRange.to 
      ? `Criado: ${formatDate(filters.createdDateRange.from)} - ${formatDate(filters.createdDateRange.to)}`
      : `Criado desde: ${formatDate(filters.createdDateRange.from)}`;
    chips.push({ key: "createdDateRange", label });
  }

  if (filters.expectedCloseDateRange?.from) {
    const label = filters.expectedCloseDateRange.to 
      ? `Prev. Fechamento: ${formatDate(filters.expectedCloseDateRange.from)} - ${formatDate(filters.expectedCloseDateRange.to)}`
      : `Prev. Fechamento desde: ${formatDate(filters.expectedCloseDateRange.from)}`;
    chips.push({ key: "expectedCloseDateRange", label });
  }

  // Chip para data de fechamento real (closed_at)
  if (filters.closedDateRange?.from) {
    const label = filters.closedDateRange.to 
      ? `Fechado: ${formatDate(filters.closedDateRange.from)} - ${formatDate(filters.closedDateRange.to)}`
      : `Fechado desde: ${formatDate(filters.closedDateRange.from)}`;
    chips.push({ key: "closedDateRange", label });
  }

  if (filters.updatedDateRange?.from) {
    const label = filters.updatedDateRange.to 
      ? `Atualizado: ${formatDate(filters.updatedDateRange.from)} - ${formatDate(filters.updatedDateRange.to)}`
      : `Atualizado desde: ${formatDate(filters.updatedDateRange.from)}`;
    chips.push({ key: "updatedDateRange", label });
  }

  if (filters.activityStatus) {
    const statusLabels: Record<string, string> = {
      no_tasks: "Sem tarefas",
      overdue: "Atrasados",
      on_track: "Em dia",
    };
    chips.push({ key: "activityStatus", label: `Status: ${statusLabels[filters.activityStatus] || filters.activityStatus}` });
  }

  // Status (Aberto/Ganho/Perdido)
  if (filters.status && filters.status.length > 0) {
    const statusLabels: Record<string, string> = {
      open: "Aberto",
      won: "Ganho",
      lost: "Perdido"
    };
    const labels = filters.status.map(s => statusLabels[s] || s).join(", ");
    chips.push({ key: "status", label: `Status: ${labels}` });
  }

  // Probabilidade
  if (filters.probabilityMin !== undefined || filters.probabilityMax !== undefined) {
    const min = filters.probabilityMin ?? 0;
    const max = filters.probabilityMax ?? 100;
    chips.push({ key: "probability", label: `Probabilidade: ${min}% - ${max}%` });
  }

  // Etapas do pipeline
  if (filters.stageIds && filters.stageIds.length > 0) {
    chips.push({ key: "stageIds", label: `${filters.stageIds.length} etapa(s) selecionada(s)` });
  }

  filters.leadSource.forEach((source) => {
    const sourceLabels: Record<string, string> = {
      kiwify: "Kiwify",
      kiwify_upsell: "Kiwify Upsell",
      manual: "Manual",
      webchat: "Web Chat",
      whatsapp: "WhatsApp",
      indicacao: "Indicação",
    };
    chips.push({ key: `leadSource_${source}`, label: `Origem: ${sourceLabels[source] || source}` });
  });

  if (filters.assignedTo && filters.assignedTo.length > 0 && salesReps) {
    filters.assignedTo.forEach((repId) => {
      const rep = salesReps.find(r => r.id === repId);
      if (rep) {
        chips.push({ key: `assignedTo_${repId}`, label: `Responsável: ${rep.full_name}` });
      }
    });
  }

  return chips;
}

// Helper to generate chips from Contact filters
export function generateContactFilterChips(
  filters: {
    status?: string;
    lastContactFilter?: string;
    ltvMin?: number;
    ltvMax?: number;
    tags: string[];
    state?: string;
    customerType?: string;
    blocked?: string;
    subscriptionPlan?: string;
  },
  tagsData?: { id: string; name: string }[]
): FilterChip[] {
  const chips: FilterChip[] = [];
  const formatCurrency = (v: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  if (filters.status) {
    const statusLabels: Record<string, string> = {
      lead: "Lead",
      customer: "Cliente",
      churned: "Churned",
      overdue: "Inadimplente",
    };
    chips.push({ key: "status", label: `Tipo: ${statusLabels[filters.status] || filters.status}` });
  }

  if (filters.lastContactFilter) {
    const lastContactLabels: Record<string, string> = {
      "7days": "> 7 dias",
      "30days": "> 30 dias",
      never: "Nunca contactado",
    };
    chips.push({ key: "lastContactFilter", label: `Último contato: ${lastContactLabels[filters.lastContactFilter]}` });
  }

  if (filters.ltvMin !== undefined && filters.ltvMax !== undefined) {
    chips.push({ key: "ltv", label: `LTV: ${formatCurrency(filters.ltvMin)} - ${formatCurrency(filters.ltvMax)}` });
  } else if (filters.ltvMin !== undefined) {
    chips.push({ key: "ltvMin", label: `LTV ≥ ${formatCurrency(filters.ltvMin)}` });
  } else if (filters.ltvMax !== undefined) {
    chips.push({ key: "ltvMax", label: `LTV ≤ ${formatCurrency(filters.ltvMax)}` });
  }

  if (filters.state) {
    chips.push({ key: "state", label: `UF: ${filters.state}` });
  }

  if (filters.customerType && filters.customerType !== 'all') {
    chips.push({ key: "customerType", label: `Tipo: ${filters.customerType}` });
  }

  if (filters.blocked && filters.blocked !== 'all') {
    chips.push({ key: "blocked", label: filters.blocked === 'true' ? "Bloqueados" : "Ativos" });
  }

  if (filters.subscriptionPlan && filters.subscriptionPlan !== 'all') {
    chips.push({ key: "subscriptionPlan", label: `Plano: ${filters.subscriptionPlan}` });
  }

  filters.tags.forEach((tagId) => {
    const tag = tagsData?.find(t => t.id === tagId);
    if (tag) {
      chips.push({ key: `tag_${tagId}`, label: `Tag: ${tag.name}` });
    }
  });

  return chips;
}
