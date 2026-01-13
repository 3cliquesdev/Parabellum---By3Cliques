import { cn } from "@/lib/utils";
import { useTicketCounts } from "@/hooks/useTicketCounts";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";
import { getStatusIcon } from "@/lib/ticketStatusIcons";
import { 
  Inbox, 
  User, 
  AlertTriangle,
  FolderOpen,
  Archive,
  Tag,
} from "lucide-react";

export type SidebarFilter = string;

interface TicketsSidebarProps {
  selectedFilter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
}

interface FilterItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  countKey: string;
  variant?: 'danger' | 'warning' | 'success' | 'default';
  indent?: boolean;
  color?: string;
}

const mainFilters: FilterItem[] = [
  { key: 'all', label: 'Todos os tickets', icon: <Inbox className="w-4 h-4" />, countKey: 'total' },
  { key: 'my_open', label: 'Meus tickets abertos', icon: <User className="w-4 h-4" />, countKey: 'my_open' },
  { key: 'unassigned', label: 'Não atribuídos', icon: <FolderOpen className="w-4 h-4" />, countKey: 'unassigned' },
  { key: 'sla_expired', label: 'SLA vencido', icon: <AlertTriangle className="w-4 h-4" />, countKey: 'sla_expired', variant: 'danger' },
  { key: 'no_tags', label: 'Sem tag', icon: <Tag className="w-4 h-4" />, countKey: 'no_tags', variant: 'warning' },
];

export function TicketsSidebar({ selectedFilter, onFilterChange }: TicketsSidebarProps) {
  const { data: counts, isLoading: countsLoading, error: countsError } = useTicketCounts();
  const { data: statuses } = useActiveTicketStatuses();

  // Log error for debugging
  if (countsError) {
    console.error('Erro ao carregar contagens de tickets:', countsError);
  }

  // Separate active from archived statuses
  const activeStatuses = statuses?.filter(s => !s.is_archived_status) || [];
  const archivedStatuses = statuses?.filter(s => s.is_archived_status) || [];

  const getCount = (key: string): string | number => {
    if (countsLoading) return '…';
    if (countsError) return '!';
    if (!counts) return 0;
    return (counts as any)[key] || 0;
  };

  const renderFilterItem = (item: FilterItem) => {
    const count = getCount(item.countKey);
    const isSelected = selectedFilter === item.key;

    return (
      <button
        key={item.key}
        onClick={() => onFilterChange(item.key)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
          item.indent && "pl-7",
          isSelected 
            ? "bg-primary/10 text-primary font-medium" 
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-2">
          {item.icon}
          <span>{item.label}</span>
        </div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full min-w-[24px] text-center",
            item.variant === 'danger' && typeof count === 'number' && count > 0
              ? "bg-destructive/10 text-destructive"
              : item.variant === 'warning' && typeof count === 'number' && count > 0
              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
              : item.variant === 'success'
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      </button>
    );
  };

  const renderStatusItem = (status: typeof activeStatuses[0], indent = false) => {
    const count = getCount(status.name);
    const isSelected = selectedFilter === status.name;
    const IconComponent = getStatusIcon(status.icon);

    return (
      <button
        key={status.name}
        onClick={() => onFilterChange(status.name)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
          indent && "pl-7",
          isSelected 
            ? "bg-primary/10 text-primary font-medium" 
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4" style={{ color: status.color }} />
          <span>{status.label}</span>
        </div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full min-w-[24px] text-center",
            status.is_archived_status
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      </button>
    );
  };

  // Calculate archived total
  const archivedTotal = countsLoading ? '…' : countsError ? '!' : archivedStatuses.reduce((sum, s) => {
    const c = getCount(s.name);
    return sum + (typeof c === 'number' ? c : 0);
  }, 0);

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Main Filters */}
      <div className="p-3 space-y-1">
        {mainFilters.map(renderFilterItem)}
      </div>

      {/* Divider */}
      <div className="px-3 py-2">
        <div className="border-t border-border" />
      </div>

      {/* Active Status Filters (dynamic) */}
      <div className="px-3 pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
          Por Status
        </p>
        <div className="space-y-1">
          {activeStatuses.map(status => renderStatusItem(status))}
        </div>
      </div>

      {/* Divider */}
      <div className="px-3 py-2">
        <div className="border-t border-border" />
      </div>

      {/* Archived Section (dynamic) */}
      <div className="px-3 pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
          Arquivados
        </p>
        <div className="space-y-1">
          {/* All archived button */}
          <button
            onClick={() => onFilterChange('archived')}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-left",
              selectedFilter === 'archived'
                ? "bg-primary/10 text-primary font-medium" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              <span>Todos arquivados</span>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full min-w-[24px] text-center bg-muted text-muted-foreground">
              {archivedTotal}
            </span>
          </button>
          {archivedStatuses.map(status => renderStatusItem(status, true))}
        </div>
      </div>
    </div>
  );
}
