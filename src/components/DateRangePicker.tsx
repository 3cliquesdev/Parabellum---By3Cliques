import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { format, startOfToday, startOfYesterday, endOfYesterday, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, subDays, startOfQuarter, endOfQuarter, startOfDay, endOfDay, endOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Função timezone-safe para comparar datas por dia
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Normaliza range DURANTE seleção - NÃO força to quando não definido
const normalizePartialRange = (range: DateRange | undefined): DateRange | undefined => {
  if (!range || !range.from) return undefined;
  
  const from = startOfDay(range.from);
  // Mantém to como undefined se usuário ainda não selecionou
  const to = range.to ? endOfDay(range.to) : undefined;
  
  return { from, to };
};

// Normaliza range FINAL - garante que to existe para uso externo
const normalizeFinalRange = (range: DateRange | undefined): DateRange | undefined => {
  if (!range || !range.from) return undefined;
  
  const from = startOfDay(range.from);
  // Se só tem from, define to como fim do mesmo dia
  const to = range.to ? endOfDay(range.to) : endOfDay(from);
  
  return { from, to };
};

export interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

type PresetKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'last30Days' | 'last90Days' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear' | 'custom';

const presets: Record<PresetKey, { label: string; getRange: () => DateRange }> = {
  today: {
    label: 'Hoje',
    getRange: () => ({
      from: startOfToday(),
      to: endOfToday(),
    }),
  },
  yesterday: {
    label: 'Ontem',
    getRange: () => ({
      from: startOfYesterday(),
      to: endOfYesterday(),
    }),
  },
  thisWeek: {
    label: 'Esta Semana',
    getRange: () => ({
      from: startOfWeek(new Date(), { locale: ptBR }),
      to: endOfWeek(new Date(), { locale: ptBR }),
    }),
  },
  lastWeek: {
    label: 'Semana Passada',
    getRange: () => ({
      from: startOfWeek(subWeeks(new Date(), 1), { locale: ptBR }),
      to: endOfWeek(subWeeks(new Date(), 1), { locale: ptBR }),
    }),
  },
  last30Days: {
    label: 'Últimos 30 dias',
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfToday(),
    }),
  },
  last90Days: {
    label: 'Últimos 90 dias',
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 90)),
      to: endOfToday(),
    }),
  },
  thisMonth: {
    label: 'Este Mês',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  lastMonth: {
    label: 'Mês Passado',
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  thisQuarter: {
    label: 'Este Trimestre',
    getRange: () => ({
      from: startOfQuarter(new Date()),
      to: endOfQuarter(new Date()),
    }),
  },
  thisYear: {
    label: 'Este Ano',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
  lastYear: {
    label: 'Ano Passado',
    getRange: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: endOfYear(subYears(new Date(), 1)),
    }),
  },
  custom: {
    label: 'Personalizado',
    getRange: () => ({
      from: undefined,
      to: undefined,
    }),
  },
};

const presetOrder: PresetKey[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'last30Days', 'last90Days', 'thisMonth', 'lastMonth', 'thisQuarter', 'thisYear', 'lastYear'];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('thisMonth');
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Estado interno para seleção em progresso - evita re-render do pai durante seleção
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(value);

  // Detecta automaticamente o preset baseado no value
  const detectPresetFromValue = useCallback((range: DateRange | undefined): PresetKey => {
    if (!range?.from || !range?.to) return 'custom';
    
    for (const key of presetOrder) {
      const presetRange = presets[key].getRange();
      if (
        sameDay(range.from, presetRange.from) &&
        sameDay(range.to, presetRange.to)
      ) {
        return key;
      }
    }
    return 'custom';
  }, []);

  // Sincronizar quando value muda externamente
  useEffect(() => {
    const detected = detectPresetFromValue(value);
    if (detected !== activePreset) {
      setActivePreset(detected);
    }
  }, [value, detectPresetFromValue]);

  const handlePresetChange = (preset: PresetKey) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      const range = presets[preset].getRange();
      onChange(normalizeFinalRange(range));
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    // Atualiza APENAS o estado interno durante a seleção
    const partial = normalizePartialRange(range);
    setDraftRange(partial);
    // NÃO chama setActivePreset aqui - isso causa re-render que fecha o popover
    
    // Se range completo (usuário selecionou ambas as datas), finaliza
    if (partial?.from && partial?.to) {
      onChange(normalizeFinalRange(range));
      setCalendarOpen(false);
    }
    // NÃO chama onChange quando incompleto - evita re-render do pai
  };

  // Sincroniza draftRange quando o calendário abre
  const handleCalendarOpenChange = (open: boolean) => {
    if (open) {
      // Ao abrir, já marca como custom e inicializa com o valor atual
      setActivePreset('custom');
      setDraftRange(value);
    } else {
      // Ao fechar sem completar, descarta seleção incompleta
      if (draftRange?.from && !draftRange?.to) {
        setDraftRange(value);
        // Restaurar preset anterior se cancelou sem valor definido
        if (!value?.from) {
          setActivePreset('thisMonth');
        }
      }
    }
    setCalendarOpen(open);
  };

  const getDisplayLabel = () => {
    // Se é custom, sempre mostrar datas
    if (activePreset === 'custom') {
      if (value?.from && value?.to) {
        return `${format(value.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(value.to, "dd/MM/yyyy", { locale: ptBR })}`;
      }
      return "Personalizado";
    }
    
    // Se não é custom mas temos value, verificar se corresponde ao preset
    if (value?.from && value?.to) {
      const presetRange = presets[activePreset].getRange();
      if (
        sameDay(value.from, presetRange.from) &&
        sameDay(value.to, presetRange.to)
      ) {
        return presets[activePreset].label;
      }
      // Não corresponde - mostrar datas formatadas
      return `${format(value.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(value.to, "dd/MM/yyyy", { locale: ptBR })}`;
    }
    
    return presets[activePreset].label;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Dropdown de Presets */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[180px] justify-between">
            <span>{getDisplayLabel()}</span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px] bg-background z-50">
          {presetOrder.map((key) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handlePresetChange(key)}
              className={cn(
                "cursor-pointer",
                activePreset === key && "bg-accent font-medium"
              )}
            >
              {presets[key].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Calendário Personalizado */}
      <Popover open={calendarOpen} onOpenChange={handleCalendarOpenChange} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant={calendarOpen || activePreset === 'custom' ? "default" : "outline"}
            className="gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            {activePreset === 'custom' && value?.from && value?.to ? (
              <span className="hidden sm:inline">
                {format(value.from, "dd/MM", { locale: ptBR })} - {format(value.to, "dd/MM", { locale: ptBR })}
              </span>
            ) : (
              <span className="hidden sm:inline">Período Personalizado</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="end">
          {/* Instrução quando aguardando data final */}
          {draftRange?.from && !draftRange?.to && (
            <div className="px-4 py-2 text-sm text-muted-foreground border-b bg-muted/50">
              Agora selecione a data final
            </div>
          )}
          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
