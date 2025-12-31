import { cn } from "@/lib/utils";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import type { DateRange } from "react-day-picker";

interface DatePresetButtonsProps {
  value?: DateRange;
  onChange: (range?: DateRange) => void;
  mode?: "past" | "future" | "both";
}

const getPastPresets = () => [
  { label: "Hoje", getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Esta Semana", getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "Este Mês", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Últimos 7 dias", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Últimos 30 dias", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
];

const getFuturePresets = () => [
  { label: "Hoje", getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Próximos 7 dias", getRange: () => ({ from: new Date(), to: addDays(new Date(), 7) }) },
  { label: "Próximos 30 dias", getRange: () => ({ from: new Date(), to: addDays(new Date(), 30) }) },
  { label: "Este Mês", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
];

export function DatePresetButtons({ value, onChange, mode = "past" }: DatePresetButtonsProps) {
  const presets = mode === "future" ? getFuturePresets() : getPastPresets();

  const isActive = (preset: typeof presets[0]) => {
    if (!value?.from) return false;
    const range = preset.getRange();
    return (
      value.from?.toDateString() === range.from.toDateString() &&
      value.to?.toDateString() === range.to.toDateString()
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => {
            if (isActive(preset)) {
              onChange(undefined);
            } else {
              onChange(preset.getRange());
            }
          }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
            isActive(preset)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
