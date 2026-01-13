import { useState, useEffect, ReactNode } from "react";
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
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
}

export function SlashCommandMenu({ children, value, onChange, onKeyDown, inputRef }: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slashPosition, setSlashPosition] = useState(-1);
  const [isShortcutMode, setIsShortcutMode] = useState(false);

  const { data: macros = [] } = useCannedResponses(searchQuery);
  const incrementUsage = useIncrementMacroUsage();

  // Detectar atalho Ctrl+M ou Cmd+M
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+M (Windows/Linux) ou Cmd+M (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        
        // Abrir menu no modo "shortcut" (inserção direta no final)
        setSlashPosition(-1);
        setSearchQuery("");
        setIsShortcutMode(true);
        setOpen(true);
        setSelectedIndex(0);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Detectar quando usuário digita "\" - COM DEBOUNCE para evitar lag
  useEffect(() => {
    // Não sobrescrever se está no modo shortcut
    if (isShortcutMode && open) return;

    // Check rápido: se não tem "\", fechar menu e sair imediatamente
    if (!value.includes("\\")) {
      if (open) {
        setOpen(false);
        setIsShortcutMode(false);
      }
      return;
    }

    // Debounce de 100ms para evitar processamento excessivo durante digitação rápida
    const timer = setTimeout(() => {
      const lastBackslashIndex = value.lastIndexOf("\\");
      const triggerIndex = lastBackslashIndex;
      
      if (triggerIndex !== -1) {
        const textAfterTrigger = value.substring(triggerIndex + 1);
        
        // Se não tem espaço depois do trigger, pode ser comando
        if (!textAfterTrigger.includes(" ") && !textAfterTrigger.includes("\n")) {
          setSlashPosition(triggerIndex);
          setSearchQuery(textAfterTrigger);
          setIsShortcutMode(false);
          setOpen(true);
          setSelectedIndex(0);
        } else {
          setOpen(false);
          setIsShortcutMode(false);
        }
      } else {
        setOpen(false);
        setIsShortcutMode(false);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [value, isShortcutMode, open]);

  const handleSelectMacro = async (macro: any) => {
    let newValue: string;
    
    if (isShortcutMode || slashPosition === -1) {
      // Modo shortcut: inserir no final do texto atual
      newValue = value + macro.content;
    } else {
      // Modo slash/backslash: substituir /comando ou \comando pelo conteúdo
      const beforeSlash = value.substring(0, slashPosition);
      const afterCommand = value.substring(slashPosition + searchQuery.length + 1);
      newValue = beforeSlash + macro.content + afterCommand;
    }
    
    onChange(newValue);
    setOpen(false);
    setIsShortcutMode(false);
    
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
      {/* Children (input/textarea) separado do PopoverTrigger para não interferir no foco */}
      <div onKeyDown={handleKeyDown}>
        {children}
      </div>
      
      {/* Popover controlado apenas por estado */}
      <Popover open={open} onOpenChange={setOpen}>
        {/* Trigger invisível apenas para ancoragem do popover */}
        <PopoverTrigger asChild>
          <div className="absolute bottom-0 left-0 w-0 h-0" />
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-96" 
          align="start"
          side="top"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              <CommandEmpty>
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">Nenhuma macro encontrada</p>
                  <p className="text-xs mt-1">Digite "\" seguido de um atalho</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Ctrl</kbd>
                    {" + "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">M</kbd>
                    {" para abrir rapidamente"}
                  </p>
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
