import { cn } from "@/lib/utils";

interface ValuePresetButtonsProps {
  valueMin?: number;
  valueMax?: number;
  onSelect: (min?: number, max?: number) => void;
}

const presets = [
  { label: "R$ 0 - 5k", min: 0, max: 5000 },
  { label: "R$ 5k - 20k", min: 5000, max: 20000 },
  { label: "R$ 20k - 50k", min: 20000, max: 50000 },
  { label: "> R$ 50k", min: 50000, max: undefined },
];

export function ValuePresetButtons({ valueMin, valueMax, onSelect }: ValuePresetButtonsProps) {
  const isActive = (preset: typeof presets[0]) => {
    return valueMin === preset.min && valueMax === preset.max;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => {
            if (isActive(preset)) {
              onSelect(undefined, undefined);
            } else {
              onSelect(preset.min, preset.max);
            }
          }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
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
