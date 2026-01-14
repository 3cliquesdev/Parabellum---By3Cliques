import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuildInfoPopover } from "@/components/BuildInfoPopover";
import { 
  getCurrentBuildId, 
  checkForUpdate, 
  forceUpdate 
} from "@/lib/build/ensureLatestBuild";
import { toast } from "sonner";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Intervalo de verificação: 60 segundos
const CHECK_INTERVAL_MS = 60 * 1000;

export function SidebarVersionIndicator() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  
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
    return id.slice(0, 16);
  };
  
  // Verificar atualizações periodicamente
  useEffect(() => {
    const checkUpdate = async () => {
      const updateAvailable = await checkForUpdate();
      setHasUpdate(updateAvailable);
    };
    
    // Verificar imediatamente
    checkUpdate();
    
    // Verificar a cada 60 segundos
    const interval = setInterval(checkUpdate, CHECK_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleForceUpdate = async () => {
    setUpdating(true);
    toast.info("Atualizando para nova versão...");
    setTimeout(() => {
      forceUpdate();
    }, 500);
  };
  
  // Versão colapsada
  if (collapsed) {
    return (
      <div className="mx-2 mb-2">
        {hasUpdate ? (
          <Button
            variant="outline"
            size="icon"
            onClick={handleForceUpdate}
            disabled={updating}
            className="w-full h-9 relative border-primary/30 bg-primary/10 hover:bg-primary/20"
            title="Nova versão disponível! Clique para atualizar"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
          </Button>
        ) : (
          <div className="flex justify-center">
            <BuildInfoPopover />
          </div>
        )}
      </div>
    );
  }
  
  // Versão expandida
  return (
    <div className="mx-3 mb-2 space-y-2">
      {/* Banner de atualização disponível */}
      {hasUpdate && (
        <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 text-primary text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Nova versão disponível!</span>
          </div>
          <Button 
            size="sm" 
            className="w-full mt-2 h-7 text-xs"
            onClick={handleForceUpdate}
            disabled={updating}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", updating && "animate-spin")} />
            Atualizar Agora
          </Button>
        </div>
      )}
      
      {/* Indicador de versão atual */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          v{formatBuildId(buildId)}
        </span>
        <BuildInfoPopover />
      </div>
    </div>
  );
}
