import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Search } from "lucide-react";
import { useCannedResponses, useIncrementMacroUsage } from "@/hooks/useCannedResponses";
import { cn } from "@/lib/utils";

interface MacrosPopoverProps {
  onSelectMacro: (content: string) => void;
  disabled?: boolean;
}

// FASE 5: Menu de Macros (Respostas Rápidas)
export function MacrosPopover({ onSelectMacro, disabled }: MacrosPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: macros = [], isLoading } = useCannedResponses(search || undefined);
  const incrementUsage = useIncrementMacroUsage();

  const handleSelect = (macro: { id: string; content: string }) => {
    onSelectMacro(macro.content);
    incrementUsage.mutate(macro.id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-10 w-10 shrink-0 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          title="Macros / Respostas Rápidas"
        >
          <Zap className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="start"
        side="top"
        sideOffset={8}
      >
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar macro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>
        
        <ScrollArea className="h-[280px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : macros.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {search ? "Nenhuma macro encontrada" : "Nenhuma macro cadastrada"}
            </div>
          ) : (
            <div className="p-2">
              {macros.map((macro) => (
                <button
                  key={macro.id}
                  onClick={() => handleSelect(macro)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg hover:bg-accent transition-colors",
                    "border border-transparent hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate flex-1">
                      {macro.title}
                    </span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      /{macro.shortcut}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {macro.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground text-center">
            Digite <code className="px-1 rounded bg-muted">/</code> no campo de mensagem para acessar macros
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
