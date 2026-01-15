import { useState, useEffect, useRef } from "react";
import { Info, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  getCurrentBuildId, 
  checkForUpdate, 
  forceUpdate,
  hardRefresh
} from "@/lib/build/ensureLatestBuild";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Intervalo de verificação: 30 segundos
const CHECK_INTERVAL_MS = 30 * 1000;

export function SidebarVersionIndicator() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const previousHasUpdate = useRef(false);
  
  const buildId = getCurrentBuildId();
  
  // Formata o buildId para exibição
  const formatBuildId = (id: string) => {
    try {
      const date = new Date(id);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
    } catch {
      // não é uma data válida
    }
    // Para hashes/etags, mostrar versão curta
    if (id.startsWith('hash-') || id.startsWith('etag-') || id.startsWith('lm-')) {
      return id.substring(0, 16) + '...';
    }
    return id.slice(0, 16);
  };
  
  // Verificar atualizações periodicamente
  useEffect(() => {
    const checkUpdate = async () => {
      const updateAvailable = await checkForUpdate();
      
      // Se antes não tinha update e agora tem, mostrar toast
      if (updateAvailable && !previousHasUpdate.current) {
        toast.info("Nova versão disponível!", {
          description: "Clique no ícone de versão para atualizar.",
          duration: 10000,
          action: {
            label: "Atualizar",
            onClick: () => {
              setUpdating(true);
              setTimeout(() => forceUpdate(), 300);
            },
          },
        });
      }
      
      previousHasUpdate.current = updateAvailable;
      setHasUpdate(updateAvailable);
    };
    
    // Verificar imediatamente
    checkUpdate();
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkUpdate, CHECK_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleForceUpdate = async () => {
    if (hasUpdate) {
      setUpdating(true);
      toast.info("Atualizando para nova versão...");
      setTimeout(() => {
        forceUpdate();
      }, 500);
    } else {
      // Verificar manualmente
      setChecking(true);
      toast.info("Verificando atualizações...");
      const updateAvailable = await checkForUpdate();
      setChecking(false);
      
      if (updateAvailable) {
        setHasUpdate(true);
        toast.success("Nova versão encontrada!", {
          action: {
            label: "Atualizar",
            onClick: () => {
              setUpdating(true);
              setTimeout(() => forceUpdate(), 300);
            },
          },
        });
      } else {
        toast.success("Você está na versão mais recente!");
      }
    }
  };
  
  const handleHardRefresh = async () => {
    setHardRefreshing(true);
    toast.info("Limpando todos os caches e recarregando...", {
      description: "Isso pode levar alguns segundos."
    });
    
    // Pequeno delay para o toast aparecer
    setTimeout(async () => {
      await hardRefresh();
    }, 500);
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={hasUpdate ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 relative transition-all duration-300",
            hasUpdate && "bg-primary text-primary-foreground"
          )}
          title={hasUpdate ? "Nova versão disponível!" : `Versão: ${formatBuildId(buildId)}`}
        >
          <Info className="h-4 w-4" />
          {/* Badge animado quando há update */}
          {hasUpdate && (
            <div className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end" side="top">
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Versão atual:</span>
            <br />
            <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
              {formatBuildId(buildId)}
            </code>
          </div>
          
          {hasUpdate && (
            <div className="p-2 rounded bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
              ✨ Nova versão disponível!
            </div>
          )}
          
          {/* Botão de atualização normal */}
          <Button 
            size="sm" 
            className="w-full h-8 text-xs"
            variant={hasUpdate ? "default" : "outline"}
            onClick={handleForceUpdate}
            disabled={updating || checking || hardRefreshing}
          >
            <RefreshCw className={cn(
              "h-3 w-3 mr-1.5", 
              (updating || checking) && "animate-spin"
            )} />
            {updating 
              ? "Atualizando..." 
              : checking 
                ? "Verificando..." 
                : hasUpdate 
                  ? "Atualizar Agora" 
                  : "Verificar Atualização"
            }
          </Button>
          
          {/* Botão de Hard Refresh */}
          <Button 
            size="sm" 
            className="w-full h-8 text-xs"
            variant="destructive"
            onClick={handleHardRefresh}
            disabled={updating || checking || hardRefreshing}
          >
            <Trash2 className={cn(
              "h-3 w-3 mr-1.5", 
              hardRefreshing && "animate-spin"
            )} />
            {hardRefreshing ? "Limpando..." : "Hard Refresh (Limpar Cache)"}
          </Button>
          
          {!hasUpdate && !updating && !checking && !hardRefreshing && (
            <p className="text-[10px] text-muted-foreground text-center">
              ✓ Versão mais recente
            </p>
          )}
          
          <p className="text-[9px] text-muted-foreground/70 text-center border-t pt-2">
            Use "Hard Refresh" se a atualização normal não funcionar
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
