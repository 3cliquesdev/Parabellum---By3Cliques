import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTags } from "@/hooks/useTags";
import { useUsers } from "@/hooks/useUsers";
import { useDepartments } from "@/hooks/useDepartments";
import type { InboxFilters } from "./InboxFilterPopover";

interface ActiveFilterChipsProps {
  filters: InboxFilters;
  onFiltersChange: (filters: InboxFilters) => void;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  web_chat: "Web Chat",
  email: "Email",
  instagram: "Instagram",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  pending: "Pendente",
  closed: "Resolvido",
};

const AI_MODE_LABELS: Record<string, string> = {
  ai_all: "Todas da IA",
  ai_only: "Somente IA",
  autopilot: "Autopilot",
  copilot: "Copilot",
  waiting_human: "Aguardando Humano",
  disabled: "IA Desabilitada",
};

const WAITING_LABELS: Record<string, string> = {
  "1h": "+1h espera",
  "4h": "+4h espera",
  "24h": "+24h espera",
  "7d": "+7 dias espera",
  newest: "Mais recentes",
  oldest: "Mais antigas",
};

export function ActiveFilterChips({ filters, onFiltersChange }: ActiveFilterChipsProps) {
  const { data: tags } = useTags();
  const { data: users } = useUsers();
  const { data: departments } = useDepartments({ activeOnly: true });

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  // Channels
  filters.channels.forEach((ch) => {
    chips.push({
      key: `ch-${ch}`,
      label: `Canal: ${CHANNEL_LABELS[ch] || ch}`,
      onRemove: () =>
        onFiltersChange({ ...filters, channels: filters.channels.filter((c) => c !== ch) }),
    });
  });

  // Status
  filters.status.forEach((s) => {
    chips.push({
      key: `st-${s}`,
      label: `Status: ${STATUS_LABELS[s] || s}`,
      onRemove: () =>
        onFiltersChange({ ...filters, status: filters.status.filter((x) => x !== s) }),
    });
  });

  // Tags
  filters.tags.forEach((tagId) => {
    const tag = tags?.find((t) => t.id === tagId);
    chips.push({
      key: `tag-${tagId}`,
      label: `Tag: ${tag?.name || tagId.slice(0, 8)}`,
      onRemove: () =>
        onFiltersChange({ ...filters, tags: filters.tags.filter((t) => t !== tagId) }),
    });
  });

  // Department
  if (filters.departmentId) {
    const dept = departments?.find((d) => d.id === filters.departmentId);
    chips.push({
      key: "dept",
      label: `Depto: ${dept?.name || "..."}`,
      onRemove: () => onFiltersChange({ ...filters, departmentId: undefined }),
    });
  }

  // Assigned
  if (filters.assignedTo) {
    const agentName =
      filters.assignedTo === "unassigned"
        ? "Não atribuídos"
        : users?.find((u) => u.id === filters.assignedTo)?.full_name || "Agente";
    chips.push({
      key: "assigned",
      label: `Agente: ${agentName}`,
      onRemove: () => onFiltersChange({ ...filters, assignedTo: undefined }),
    });
  }

  // AI mode
  if (filters.aiMode) {
    chips.push({
      key: "aiMode",
      label: `IA: ${AI_MODE_LABELS[filters.aiMode] || filters.aiMode}`,
      onRemove: () => onFiltersChange({ ...filters, aiMode: undefined }),
    });
  }

  // SLA
  if (filters.slaExpired) {
    chips.push({
      key: "sla",
      label: "SLA expirado",
      onRemove: () => onFiltersChange({ ...filters, slaExpired: false }),
    });
  }

  // Audio / Attachments
  if (filters.hasAudio) {
    chips.push({
      key: "audio",
      label: "Com áudio",
      onRemove: () => onFiltersChange({ ...filters, hasAudio: undefined }),
    });
  }
  if (filters.hasAttachments) {
    chips.push({
      key: "attach",
      label: "Com anexos",
      onRemove: () => onFiltersChange({ ...filters, hasAttachments: undefined }),
    });
  }

  // Waiting time (skip 'all' and 'oldest' which is the default)
  if (filters.waitingTime && filters.waitingTime !== "all" && filters.waitingTime !== "oldest") {
    chips.push({
      key: "wait",
      label: WAITING_LABELS[filters.waitingTime] || filters.waitingTime,
      onRemove: () => onFiltersChange({ ...filters, waitingTime: "oldest" }),
    });
  }

  // Date range
  if (filters.dateRange?.from) {
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
    const label = filters.dateRange.to
      ? `${fmt(filters.dateRange.from)} – ${fmt(filters.dateRange.to)}`
      : `A partir de ${fmt(filters.dateRange.from)}`;
    chips.push({
      key: "date",
      label,
      onRemove: () => onFiltersChange({ ...filters, dateRange: undefined }),
    });
  }

  // Archived
  if (filters.includeArchived) {
    chips.push({
      key: "archived",
      label: "+Arquivadas",
      onRemove: () => onFiltersChange({ ...filters, includeArchived: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 px-4 py-1.5 border-b border-border bg-muted/30">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 text-[10px] h-5 px-1.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={chip.onRemove}
        >
          {chip.label}
          <X className="h-2.5 w-2.5" />
        </Badge>
      ))}
    </div>
  );
}
