import { cn } from "@/lib/utils";
import { useTicketCounts } from "@/hooks/useTicketCounts";
import { 
  Inbox, 
  Clock, 
  AlertCircle, 
  User, 
  CheckCircle, 
  AlertTriangle,
  FolderOpen,
  Archive,
  XCircle
} from "lucide-react";

export type SidebarFilter = 
  | 'all' 
  | 'open' 
  | 'in_progress' 
  | 'waiting_customer' 
  | 'resolved' 
  | 'closed'
  | 'my_open' 
  | 'unassigned' 
  | 'sla_expired'
  | 'archived';

interface TicketsSidebarProps {
  selectedFilter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
}

interface FilterItem {
  key: SidebarFilter;
  label: string;
  icon: React.ReactNode;
  countKey: string;
  variant?: 'danger' | 'warning' | 'success' | 'default';
  indent?: boolean;
}

const mainFilters: FilterItem[] = [
  { key: 'all', label: 'Todos os tickets', icon: <Inbox className="w-4 h-4" />, countKey: 'total' },
  { key: 'my_open', label: 'Meus tickets abertos', icon: <User className="w-4 h-4" />, countKey: 'my_open' },
  { key: 'unassigned', label: 'Não atribuídos', icon: <FolderOpen className="w-4 h-4" />, countKey: 'unassigned' },
  { key: 'sla_expired', label: 'SLA vencido', icon: <AlertTriangle className="w-4 h-4" />, countKey: 'sla_expired', variant: 'danger' },
];

const activeStatusFilters: FilterItem[] = [
  { key: 'open', label: 'Novos', icon: <Clock className="w-4 h-4" />, countKey: 'open' },
  { key: 'in_progress', label: 'Em análise', icon: <Clock className="w-4 h-4" />, countKey: 'in_progress' },
  { key: 'waiting_customer', label: 'Aguardando cliente', icon: <AlertCircle className="w-4 h-4" />, countKey: 'waiting_customer', variant: 'warning' },
];

const archivedFilters: FilterItem[] = [
  { key: 'archived', label: 'Todos arquivados', icon: <Archive className="w-4 h-4" />, countKey: 'archived' },
  { key: 'resolved', label: 'Resolvidos', icon: <CheckCircle className="w-4 h-4" />, countKey: 'resolved', variant: 'success', indent: true },
  { key: 'closed', label: 'Fechados', icon: <XCircle className="w-4 h-4" />, countKey: 'closed', indent: true },
];

export function TicketsSidebar({ selectedFilter, onFilterChange }: TicketsSidebarProps) {
  const { data: counts } = useTicketCounts();

  const getCount = (key: string): number => {
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
            item.variant === 'danger' && count > 0
              ? "bg-destructive/10 text-destructive"
              : item.variant === 'warning' && count > 0
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

      {/* Active Status Filters */}
      <div className="px-3 pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
          Por Status
        </p>
        <div className="space-y-1">
          {activeStatusFilters.map(renderFilterItem)}
        </div>
      </div>

      {/* Divider */}
      <div className="px-3 py-2">
        <div className="border-t border-border" />
      </div>

      {/* Archived Section */}
      <div className="px-3 pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
          Arquivados
        </p>
        <div className="space-y-1">
          {archivedFilters.map(renderFilterItem)}
        </div>
      </div>
    </div>
  );
}
