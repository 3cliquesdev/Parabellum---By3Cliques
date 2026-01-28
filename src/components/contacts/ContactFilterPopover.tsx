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
import { useTags } from "@/hooks/useTags";

export interface ContactFilters {
  status?: string;
  lastContactFilter?: string;
  ltvMin?: number;
  ltvMax?: number;
  tags: string[];
  state?: string;
  customerType?: string;
  blocked?: string;
  subscriptionPlan?: string;
  search: string;
}

interface ContactFilterPopoverProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
}

const CONTACT_STATUS = [
  { value: "lead", label: "Lead" },
  { value: "customer", label: "Cliente" },
  { value: "churned", label: "Churned" },
  { value: "overdue", label: "Inadimplente" },
];

const LAST_CONTACT_OPTIONS = [
  { value: "7days", label: "Mais de 7 dias" },
  { value: "30days", label: "Mais de 30 dias" },
  { value: "never", label: "Nunca contactado" },
];

const CUSTOMER_TYPES = [
  { value: "Cliente", label: "Cliente" },
  { value: "Vendedor", label: "Vendedor" },
  { value: "Fornecedor", label: "Fornecedor" },
  { value: "Parceiro", label: "Parceiro" },
];

const SUBSCRIPTION_PLANS = [
  { value: "Free", label: "Free" },
  { value: "Basic", label: "Basic" },
  { value: "Premium", label: "Premium" },
  { value: "Enterprise", label: "Enterprise" },
];

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function ContactFilterPopover({ filters, onFiltersChange }: ContactFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: tags } = useTags("customer");

  const activeFiltersCount = [
    filters.status ? 1 : 0,
    filters.lastContactFilter ? 1 : 0,
    filters.ltvMin !== undefined ? 1 : 0,
    filters.ltvMax !== undefined ? 1 : 0,
    filters.tags.length,
    filters.state ? 1 : 0,
    filters.customerType && filters.customerType !== 'all' ? 1 : 0,
    filters.blocked && filters.blocked !== 'all' ? 1 : 0,
    filters.subscriptionPlan && filters.subscriptionPlan !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleTagToggle = (tagId: string) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(t => t !== tagId)
      : [...filters.tags, tagId];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: undefined,
      lastContactFilter: undefined,
      ltvMin: undefined,
      ltvMax: undefined,
      tags: [],
      state: undefined,
      customerType: 'all',
      blocked: 'all',
      subscriptionPlan: 'all',
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
      <PopoverContent className="w-[420px] p-4" align="start">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground">Filtros de Contatos</h4>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Status (Lead/Customer/Churned) */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Tipo de Pessoa</Label>
            <Select
              value={filters.status || "all"}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                status: v === "all" ? undefined : v 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                <SelectItem value="all">Todos</SelectItem>
                {CONTACT_STATUS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Last Contact */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Último Contato</Label>
            <Select
              value={filters.lastContactFilter || "all"}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                lastContactFilter: v === "all" ? undefined : v 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer data" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                <SelectItem value="all">Qualquer data</SelectItem>
                {LAST_CONTACT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* LTV Range */}
          <div>
            <Label className="text-sm font-medium mb-2 block">LTV - Total Gasto (R$)</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Mínimo"
                  value={filters.ltvMin !== undefined ? formatCurrency(filters.ltvMin.toString()) : ""}
                  onChange={(e) => onFiltersChange({ 
                    ...filters, 
                    ltvMin: parseCurrency(e.target.value) 
                  })}
                />
              </div>
              <span className="flex items-center text-muted-foreground">até</span>
              <div className="flex-1">
                <Input
                  placeholder="Máximo"
                  value={filters.ltvMax !== undefined ? formatCurrency(filters.ltvMax.toString()) : ""}
                  onChange={(e) => onFiltersChange({ 
                    ...filters, 
                    ltvMax: parseCurrency(e.target.value) 
                  })}
                />
              </div>
            </div>
          </div>

          {/* State (UF) */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Estado (UF)</Label>
            <Select
              value={filters.state || "all"}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                state: v === "all" ? undefined : v 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os estados" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                <SelectItem value="all">Todos os estados</SelectItem>
                {BRAZILIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Type */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Tipo de Cliente</Label>
            <Select
              value={filters.customerType || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, customerType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                <SelectItem value="all">Todos os tipos</SelectItem>
                {CUSTOMER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Blocked Status */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Status de Bloqueio</Label>
            <Select
              value={filters.blocked || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, blocked: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="false">Ativos</SelectItem>
                <SelectItem value="true">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subscription Plan */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Plano de Assinatura</Label>
            <Select
              value={filters.subscriptionPlan || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, subscriptionPlan: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os planos" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                <SelectItem value="all">Todos os planos</SelectItem>
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <SelectItem key={plan.value} value={plan.value}>
                    {plan.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Tags</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
