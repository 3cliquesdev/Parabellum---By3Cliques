import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ReadOnlyVariableBadgeProps {
  variable: string;
  description: string;
  colorClass?: string;
}

export function ReadOnlyVariableBadge({ variable, description, colorClass = "text-primary" }: ReadOnlyVariableBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`{{${variable}}}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 group">
      <div className="flex flex-col gap-0.5 min-w-0">
        <code className={cn("text-[11px] font-mono font-semibold truncate", colorClass)}>
          {`{{${variable}}}`}
        </code>
        <span className="text-[10px] text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="ml-2 p-1 rounded hover:bg-muted transition-colors shrink-0"
        title="Copiar variável"
      >
        {copied ? (
          <Check className="h-3 w-3 text-success" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
        )}
      </button>
    </div>
  );
}
