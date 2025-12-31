import { cn } from "@/lib/utils";

interface StatusMultiSelectProps {
  selected: string[];
  onChange: (status: string[]) => void;
}

const statusOptions = [
  { value: "open", label: "Aberto", color: "bg-blue-500" },
  { value: "won", label: "Ganho", color: "bg-green-500" },
  { value: "lost", label: "Perdido", color: "bg-red-500" },
];

export function StatusMultiSelect({ selected, onChange }: StatusMultiSelectProps) {
  const toggleStatus = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {statusOptions.map((status) => (
        <button
          key={status.value}
          type="button"
          onClick={() => toggleStatus(status.value)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
            "border-2",
            selected.includes(status.value)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", status.color)} />
          {status.label}
        </button>
      ))}
    </div>
  );
}
