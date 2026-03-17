import { cn } from "@/lib/utils";

interface ClickableVariableBadgeProps {
  variable: string;
  label: string;
  colorClass?: string;
  onClick: (variable: string) => void;
}

export function ClickableVariableBadge({ variable, label, colorClass = "text-primary", onClick }: ClickableVariableBadgeProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(`{{${variable}}}`)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted border border-border/50 hover:border-border transition-colors cursor-pointer group"
      title={`Inserir {{${variable}}}`}
    >
      <code className={cn("text-[10px] font-mono font-semibold", colorClass)}>
        {`{{${variable}}}`}
      </code>
    </button>
  );
}

interface VariableBadgesRowProps {
  variables: { key: string; label: string; color?: string }[];
  onInsert: (variableText: string) => void;
}

export function VariableBadgesRow({ variables, onInsert }: VariableBadgesRowProps) {
  if (variables.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[9px] text-muted-foreground">Clique para inserir no campo:</p>
      <div className="flex flex-wrap gap-1">
        {variables.map((v) => (
          <ClickableVariableBadge
            key={v.key}
            variable={v.key}
            label={v.label}
            colorClass={v.color || "text-primary"}
            onClick={onInsert}
          />
        ))}
      </div>
    </div>
  );
}
