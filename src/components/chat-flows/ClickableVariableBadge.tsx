import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClickableVariableBadgeProps {
  variable: string;
  description: string;
  colorClass?: string;
  onInsert: (variable: string) => void;
}

export function ClickableVariableBadge({
  variable,
  description,
  colorClass = "text-primary",
  onInsert,
}: ClickableVariableBadgeProps) {
  const [inserted, setInserted] = useState(false);

  const handleClick = () => {
    onInsert(`{{${variable}}}`);
    setInserted(true);
    setTimeout(() => setInserted(false), 1200);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-semibold",
              "bg-muted/60 hover:bg-muted border border-transparent hover:border-border",
              "transition-all duration-150 cursor-pointer group",
              colorClass
            )}
          >
            {inserted ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Plus className="h-3 w-3 opacity-50 group-hover:opacity-100 shrink-0" />
            )}
            <span className="truncate">{`{{${variable}}}`}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{description}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Clique para inserir</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
