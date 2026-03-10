import { useState } from "react";
import { Filter, X, Search, Mic, Paperclip, Bot, Clock, Archive, Timer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
import { useUsers } from "@/hooks/useUsers";
import { useTags } from "@/hooks/useTags";
import type { DateRange } from "react-day-picker";

export interface InboxFilters {
  dateRange?: DateRange;
  channels: string[];
  status: string[];
  assignedTo?: string;
  tags: string[];
  search: string;
  slaExpired: boolean;
  // New advanced filters
  hasAudio?: boolean;
  hasAttachments?: boolean;
  aiMode?: string;
  includeArchived?: boolean;
  // Filtro de tempo de espera para priorização
  waitingTime?: 'all' | 'newest' | 'oldest' | '1h' | '4h' | '24h' | '7d';
}

interface InboxFilterPopoverProps {
  filters: InboxFilters;
  onFiltersChange: (filters: InboxFilters) => void;
}

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: "📱" },
  { value: "web_chat", label: "Web Chat", icon: "💬" },
  { value: "email", label: "Email", icon: "📧" },
  { value: "instagram", label: "Instagram", icon: "📸" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "pending", label: "Pendente" },
  { value: "closed", label: "Resolvido" },
];

const AI_MODE_OPTIONS = [
  { value: "ai_all", label: "🤖 Todas da IA" },
  { value: "ai_only", label: "🤖 Somente IA (sem humano)" },
  { value: "autopilot", label: "🤖 Autopilot" },
  { value: "copilot", label: "🧑‍✈️ Copilot" },
  { value: "waiting_human", label: "⏳ Aguardando Humano" },
  { value: "disabled", label: "❌ Desabilitado" },
];

const WAITING_TIME_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "newest", label: "⚡ Mais recentes primeiro" },
  { value: "oldest", label: "🕐 Mais antigas primeiro" },
  { value: "1h", label: "⏱️ Aguardando +1h" },
  { value: "4h", label: "⚠️ Aguardando +4h" },
  { value: "24h", label: "🔴 Aguardando +24h" },
  { value: "7d", label: "💀 Aguardando +7 dias" },
];

export default function InboxFilterPopover({ filters, onFiltersChange }: InboxFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: users } = useUsers();
  const { data: tags } = useTags();

  // Contagem de filtros ativos - search NÃO é contado (é campo separado, não "filtro")
  const activeFiltersCount = [
    filters.dateRange?.from ? 1 : 0,
    filters.channels.length,
    filters.status.length,
    filters.assignedTo ? 1 : 0,
    filters.tags.length,
    // search removido da contagem - é campo de busca, não filtro
    filters.slaExpired ? 1 : 0,
    filters.hasAudio ? 1 : 0,
    filters.hasAttachments ? 1 : 0,
    filters.aiMode ? 1 : 0,
    filters.waitingTime && filters.waitingTime !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleChannelToggle = (channel: string) => {
    const newChannels = filters.channels.includes(channel)
      ? filters.channels.filter(c => c !== channel)
      : [...filters.channels, channel];
    onFiltersChange({ ...filters, channels: newChannels });
  };

  const handleStatusToggle = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatus });
  };

  const handleTagToggle = (tagId: string) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(t => t !== tagId)
      : [...filters.tags, tagId];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const clearFilters = () => {
    onFiltersChange({
      dateRange: undefined,
      channels: [],
      status: [],
      assignedTo: undefined,
      tags: [],
      search: "",
      slaExpired: false,
      hasAudio: undefined,
      hasAttachments: undefined,
      aiMode: undefined,
      includeArchived: undefined,
      waitingTime: 'all',
    });
  };

  return (
    <div className="space-y-3">
      {/* Search Input - full width */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email, telefone, ID..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9 h-9"
        />
      </div>

      {/* Quick Filters - wrap nicely */}
      <div className="flex gap-1.5 flex-wrap">
        {/* Waiting Time Filter - NOVO! */}
        <Select
          value={filters.waitingTime || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, waitingTime: v as InboxFilters['waitingTime'] })}
        >
          <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs gap-1">
            <Timer className="h-3 w-3" />
            <SelectValue placeholder="Tempo de espera" />
          </SelectTrigger>
          <SelectContent 
            position="popper" 
            side="bottom" 
            align="start"
            sideOffset={4}
            className="z-[100] max-h-[200px] overflow-y-auto"
          >
            {WAITING_TIME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* SLA Expired */}
        <Button
          variant={filters.slaExpired ? "destructive" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, slaExpired: !filters.slaExpired })}
          className="gap-1 h-7 px-2 text-xs"
        >
          <Clock className="h-3 w-3" />
          SLA
        </Button>

        {/* Include Archived */}
        <Button
          variant={filters.includeArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, includeArchived: !filters.includeArchived })}
          className="gap-1 h-7 px-2 text-xs"
        >
          <Archive className="h-3 w-3" />
          +Arquivadas
        </Button>

        {/* Has Audio */}
        <Button
          variant={filters.hasAudio ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, hasAudio: !filters.hasAudio })}
          className="gap-1 h-7 px-2 text-xs"
        >
          <Mic className="h-3 w-3" />
          Áudio
        </Button>

        {/* Has Attachments */}
        <Button
          variant={filters.hasAttachments ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, hasAttachments: !filters.hasAttachments })}
          className="gap-1 h-7 px-2 text-xs"
        >
          <Paperclip className="h-3 w-3" />
          Anexos
        </Button>

        {/* Filter Popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
              <Filter className="h-3 w-3" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-4" align="end">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Filtros Avançados</h4>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Date Range */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Período</Label>
                <DatePickerWithRange
                  date={filters.dateRange}
                  onDateChange={(date) => onFiltersChange({ ...filters, dateRange: date })}
                />
              </div>

              {/* Channels */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Canais</Label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((channel) => (
                    <div key={channel.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`channel-${channel.value}`}
                        checked={filters.channels.includes(channel.value)}
                        onCheckedChange={() => handleChannelToggle(channel.value)}
                      />
                      <label
                        htmlFor={`channel-${channel.value}`}
                        className="text-sm cursor-pointer flex items-center gap-1"
                      >
                        <span>{channel.icon}</span>
                        {channel.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={filters.status.includes(status.value)}
                        onCheckedChange={() => handleStatusToggle(status.value)}
                      />
                      <label
                        htmlFor={`status-${status.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Mode */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Modo IA</Label>
                <Select
                  value={filters.aiMode || "all"}
                  onValueChange={(v) => onFiltersChange({ ...filters, aiMode: v === "all" ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os modos" />
                  </SelectTrigger>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    align="start"
                    sideOffset={4}
                    className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                  >
                    <SelectItem value="all">Todos os modos</SelectItem>
                    {AI_MODE_OPTIONS.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Atribuído a</Label>
                <Select
                  value={filters.assignedTo || "all"}
                  onValueChange={(v) => onFiltersChange({ ...filters, assignedTo: v === "all" ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os agentes" />
                  </SelectTrigger>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    align="start"
                    sideOffset={4}
                    className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                  >
                    <SelectItem value="all">Todos os agentes</SelectItem>
                    <SelectItem value="unassigned">Não atribuídos</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Tags</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {tags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag.id}`}
                          checked={filters.tags.includes(tag.id)}
                          onCheckedChange={() => handleTagToggle(tag.id)}
                        />
                        <label
                          htmlFor={`tag-${tag.id}`}
                          className="text-sm cursor-pointer flex items-center gap-1"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color || "#6B7280" }}
                          />
                          {tag.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Media Filters */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Mídia</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has-audio"
                      checked={filters.hasAudio || false}
                      onCheckedChange={(checked) => onFiltersChange({ ...filters, hasAudio: checked as boolean })}
                    />
                    <label htmlFor="has-audio" className="text-sm cursor-pointer flex items-center gap-1">
                      <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                      Com áudio
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has-attachments"
                      checked={filters.hasAttachments || false}
                      onCheckedChange={(checked) => onFiltersChange({ ...filters, hasAttachments: checked as boolean })}
                    />
                    <label htmlFor="has-attachments" className="text-sm cursor-pointer flex items-center gap-1">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      Com anexos
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
