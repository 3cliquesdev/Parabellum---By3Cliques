import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ProbabilitySliderProps {
  min?: number;
  max?: number;
  onChange: (min: number, max: number) => void;
}

const presets = [
  { label: "🥶 Frio", min: 0, max: 30, color: "bg-blue-500" },
  { label: "🌡️ Morno", min: 30, max: 70, color: "bg-yellow-500" },
  { label: "🔥 Quente", min: 70, max: 100, color: "bg-red-500" },
];

export function ProbabilitySlider({ min = 0, max = 100, onChange }: ProbabilitySliderProps) {
  const isPresetActive = (preset: typeof presets[0]) => {
    return min === preset.min && max === preset.max;
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              if (isPresetActive(preset)) {
                onChange(0, 100);
              } else {
                onChange(preset.min, preset.max);
              }
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
              isPresetActive(preset)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {preset.label} ({preset.min}-{preset.max}%)
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{min}%</span>
          <span>{max}%</span>
        </div>
        <Slider
          value={[min, max]}
          onValueChange={([newMin, newMax]) => onChange(newMin, newMax)}
          max={100}
          min={0}
          step={5}
          className="w-full"
        />
      </div>
    </div>
  );
}
