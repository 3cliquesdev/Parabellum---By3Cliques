import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";
import { getStatusIcon } from "@/lib/ticketStatusIcons";
import { useDepartments } from "@/hooks/useDepartments";
import { useInternalUsers } from "@/hooks/useInternalUsers";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  X, 
  AlertTriangle, 
  Clock,
  CalendarIcon,
  Tag,
  Building2,
  User,
  History
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

export interface TicketFilters {
  search: string;
  searchInHistory: boolean;
  status: string[];
  priority: string[];
  category: string[];
  channel: string[];
  tags: string[];
  dateRange?: DateRange;
  slaExpired: boolean;
  noTags?: boolean;
  departmentId?: string;
  assignedTo?: string;
}

interface TicketFilterPopoverProps {
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'text-green-600' },
  { value: 'medium', label: 'Média', color: 'text-yellow-600' },
  { value: 'high', label: 'Alta', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' },
];

const CATEGORY_OPTIONS = [
  { value: 'duvida', label: 'Dúvida' },
  { value: 'problema', label: 'Problema' },
  { value: 'solicitacao', label: 'Solicitação' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'outro', label: 'Outro' },
];

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'webchat', label: 'Web Chat' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'manual', label: 'Manual' },
];

export const defaultTicketFilters: TicketFilters = {
  search: '',
  searchInHistory: false,
  status: [],
  priority: [],
  category: [],
  channel: [],
  tags: [],
  dateRange: undefined,
  slaExpired: false,
  noTags: false,
  departmentId: undefined,
  assignedTo: undefined,
};

export function TicketFilterPopover({ filters, onFiltersChange }: TicketFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { data: ticketTags = [] } = useTags("ticket");
  const { data: ticketStatuses = [] } = useActiveTicketStatuses();
  const { data: departments = [] } = useDepartments({ activeOnly: true });
  const { data: agents = [] } = useInternalUsers();

  // Count active filters
  const activeFilterCount = [
    filters.status.length > 0,
    filters.priority.length > 0,
    filters.category.length > 0,
    filters.channel.length > 0,
    filters.tags.length > 0,
    filters.dateRange?.from !== undefined,
    filters.slaExpired,
    filters.departmentId !== undefined,
    filters.assignedTo !== undefined,
    filters.searchInHistory,
  ].filter(Boolean).length;

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleToggleArrayFilter = (key: 'status' | 'priority' | 'category' | 'channel' | 'tags', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const handleToggleSlaExpired = () => {
    onFiltersChange({ ...filters, slaExpired: !filters.slaExpired });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    onFiltersChange({ ...filters, dateRange: range });
  };

  const handleClearFilters = () => {
    onFiltersChange(defaultTicketFilters);
  };

  const hasActiveFilters = activeFilterCount > 0 || filters.search.length > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Search Field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={filters.searchInHistory 
            ? "Buscar em todo histórico..." 
            : "Buscar protocolo, assunto, cliente..."
          }
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 w-[280px]"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => handleSearchChange('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* History Search Toggle */}
      <Button
        variant={filters.searchInHistory ? "default" : "outline"}
        size="sm"
        onClick={() => onFiltersChange({ 
          ...filters, 
          searchInHistory: !filters.searchInHistory 
        })}
        className="gap-1"
        title="Buscar também nos comentários e mensagens de todos os tickets"
      >
        <History className="h-3.5 w-3.5" />
        Histórico
      </Button>

      {/* Quick Filters */}
      <Button
        variant={filters.slaExpired ? "destructive" : "outline"}
        size="sm"
        onClick={handleToggleSlaExpired}
        className="gap-1"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        SLA Vencido
      </Button>

      <Button
        variant={filters.priority.includes('high') || filters.priority.includes('urgent') ? "default" : "outline"}
        size="sm"
        onClick={() => {
          const hasHighPriority = filters.priority.includes('high') || filters.priority.includes('urgent');
          if (hasHighPriority) {
            onFiltersChange({ 
              ...filters, 
              priority: filters.priority.filter(p => p !== 'high' && p !== 'urgent') 
            });
          } else {
            onFiltersChange({ 
              ...filters, 
              priority: [...filters.priority.filter(p => p !== 'high' && p !== 'urgent'), 'high', 'urgent'] 
            });
          }
        }}
        className="gap-1"
      >
        <Clock className="h-3.5 w-3.5" />
        Alta Prioridade
      </Button>

      {/* Advanced Filters Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filtros Avançados</h4>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 text-xs">
                  Limpar Tudo
                </Button>
              )}
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Período de Criação</Label>
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange?.from ? (
                      filters.dateRange.to ? (
                        <>
                          {format(filters.dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                          {format(filters.dateRange.to, "dd/MM/yy", { locale: ptBR })}
                        </>
                      ) : (
                        format(filters.dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      )
                    ) : (
                      <span className="text-muted-foreground">Selecionar período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={filters.dateRange}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Departamento
              </Label>
              <Select
                value={filters.departmentId || "all"}
                onValueChange={(v) => onFiltersChange({ 
                  ...filters, 
                  departmentId: v === "all" ? undefined : v 
                })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Todos os departamentos" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start"
                  sideOffset={4}
                  className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                >
                  <SelectItem value="all">Todos os departamentos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Responsável */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Responsável
              </Label>
              <Select
                value={filters.assignedTo || "all"}
                onValueChange={(v) => onFiltersChange({ 
                  ...filters, 
                  assignedTo: v === "all" ? undefined : v 
                })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Todos os responsáveis" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start"
                  sideOffset={4}
                  className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                >
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex flex-wrap gap-2">
                {ticketStatuses.map(status => {
                  const StatusIcon = getStatusIcon(status.icon);
                  return (
                    <Button
                      key={status.name}
                      variant={filters.status.includes(status.name) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleArrayFilter('status', status.name)}
                      className="h-7 text-xs gap-1"
                      style={filters.status.includes(status.name) ? {
                        backgroundColor: status.color || undefined,
                        borderColor: status.color || undefined,
                      } : {
                        borderColor: status.color || undefined,
                        color: status.color || undefined,
                      }}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prioridade</Label>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    variant={filters.priority.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleArrayFilter('priority', option.value)}
                    className={cn("h-7 text-xs", !filters.priority.includes(option.value) && option.color)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    variant={filters.category.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleArrayFilter('category', option.value)}
                    className="h-7 text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Canal de Origem</Label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    variant={filters.channel.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleArrayFilter('channel', option.value)}
                    className="h-7 text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {ticketTags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Tags
                </Label>
                <div className="flex flex-wrap gap-2">
                  {ticketTags.map((tag: any) => (
                    <Button
                      key={tag.id}
                      variant={filters.tags.includes(tag.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleArrayFilter('tags', tag.id)}
                      className="h-7 text-xs"
                      style={filters.tags.includes(tag.id) ? {
                        backgroundColor: tag.color || undefined,
                        borderColor: tag.color || undefined,
                      } : {
                        borderColor: tag.color || undefined,
                        color: tag.color || undefined,
                      }}
                    >
                      {tag.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear All Button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
