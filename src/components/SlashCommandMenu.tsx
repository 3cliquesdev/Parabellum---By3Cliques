import { useState, useEffect, useRef, ReactNode } from "react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCannedResponses, useIncrementMacroUsage } from "@/hooks/useCannedResponses";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

interface SlashCommandMenuProps {
  children: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function SlashCommandMenu({ children, value, onChange, onKeyDown }: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slashPosition, setSlashPosition] = useState(-1);

  const { data: macros = [] } = useCannedResponses(searchQuery);
  const incrementUsage = useIncrementMacroUsage();

  // Detectar quando usuário digita "/"
  useEffect(() => {
    const lastSlashIndex = value.lastIndexOf("/");
    
    if (lastSlashIndex !== -1) {
      const textAfterSlash = value.substring(lastSlashIndex + 1);
      
      // Se não tem espaço depois da barra, pode ser comando
      if (!textAfterSlash.includes(" ") && !textAfterSlash.includes("\n")) {
        setSlashPosition(lastSlashIndex);
        setSearchQuery(textAfterSlash);
        setOpen(true);
        setSelectedIndex(0);
      } else {
        setOpen(false);
      }
    } else {
      setOpen(false);
    }
  }, [value]);

  const handleSelectMacro = async (macro: any) => {
    // Substituir /comando pelo conteúdo da macro
    const beforeSlash = value.substring(0, slashPosition);
    const afterCommand = value.substring(slashPosition + searchQuery.length + 1);
    const newValue = beforeSlash + macro.content + afterCommand;
    
    onChange(newValue);
    setOpen(false);
    
    // Incrementar contador de uso
    await incrementUsage.mutateAsync(macro.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (open && macros.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % macros.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + macros.length) % macros.length);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSelectMacro(macros[selectedIndex]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }

    // Chamar onKeyDown original se existir
    onKeyDown?.(e);
  };

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div onKeyDown={handleKeyDown}>
            {children}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-96" 
          align="start"
          side="top"
          sideOffset={8}
        >
          <Command>
            <CommandList>
              <CommandEmpty>
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">Nenhuma macro encontrada</p>
                  <p className="text-xs mt-1">Digite "/" seguido de um atalho</p>
                </div>
              </CommandEmpty>
              <CommandGroup heading="Macros Disponíveis">
                {macros.map((macro, index) => (
                  <CommandItem
                    key={macro.id}
                    value={macro.shortcut}
                    onSelect={() => handleSelectMacro(macro)}
                    className={index === selectedIndex ? "bg-accent" : ""}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">/{macro.shortcut}</span>
                          {macro.is_public && (
                            <Badge variant="secondary" className="text-xs">
                              Equipe
                            </Badge>
                          )}
                          {macro.usage_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {macro.usage_count}x
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {macro.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {macro.content}
                        </p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
