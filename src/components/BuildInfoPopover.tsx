import { useState } from "react";
import { Info, Copy, RefreshCw, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { 
  getCurrentBuildId, 
  getBuildMode, 
  copyBuildInfo, 
  forceUpdate 
} from "@/lib/build/ensureLatestBuild";
import { toast } from "sonner";

export function BuildInfoPopover() {
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const buildId = getCurrentBuildId();
  const mode = getBuildMode();
  
  // Formata o buildId para exibição (só hora:minuto:segundo se for ISO)
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
    return id.slice(0, 16); // Fallback: primeiros 16 chars
  };
  
  const handleCopy = async () => {
    const success = await copyBuildInfo();
    if (success) {
      setCopied(true);
      toast.success("Informações copiadas!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Erro ao copiar");
    }
  };
  
  const handleForceUpdate = async () => {
    setUpdating(true);
    toast.info("Forçando atualização...");
    // Pequeno delay para o toast aparecer
    setTimeout(() => {
      forceUpdate();
    }, 500);
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <Info className="h-3 w-3" />
          <span className="hidden sm:inline">v{formatBuildId(buildId)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">Informações do Build</h4>
            <p className="text-xs text-muted-foreground">
              Diagnóstico de versão do app
            </p>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build ID:</span>
              <code className="bg-muted px-1 rounded text-[10px]">
                {buildId.slice(0, 24)}...
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modo:</span>
              <span className={mode === 'production' ? 'text-green-500' : 'text-yellow-500'}>
                {mode}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span>{formatBuildId(buildId)}</span>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs h-8"
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar Info
                </>
              )}
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 text-xs h-8"
              onClick={handleForceUpdate}
              disabled={updating}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${updating ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          
          <p className="text-[10px] text-muted-foreground text-center">
            Use "Atualizar" se estiver vendo uma versão antiga
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
