import { useState, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkForUpdate, forceUpdate } from "@/lib/build/ensureLatestBuild";
import { cn } from "@/lib/utils";

/**
 * Banner de atualização - Exibe aviso quando há nova versão disponível
 * 
 * IMPORTANTE: Atualização é SOMENTE manual - usuário decide quando atualizar.
 * NÃO há refresh automático da página.
 */
export function UpdateAvailableBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isLikelyPreviewHost = () => {
    const h = window.location.hostname;
    return (
      h.includes("lovableproject.com") ||
      h.includes("lovable.app") ||
      h.includes("id-preview--")
    );
  };

  // Verificação periódica (sem auto-refresh)
  useEffect(() => {
    const checkUpdate = async () => {
      const updateAvailable = await checkForUpdate();
      if (updateAvailable) {
        setHasUpdate(true);
      }
    };

    // No preview, queremos detectar rápido para evitar ficar “preso” em build antigo.
    const initialDelayMs = isLikelyPreviewHost() ? 3000 : 30000;
    const intervalMs = isLikelyPreviewHost() ? 30 * 1000 : 5 * 60 * 1000;

    const initialTimeout = setTimeout(checkUpdate, initialDelayMs);
    const interval = setInterval(checkUpdate, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = () => {
    setUpdating(true);
    setTimeout(() => {
      forceUpdate();
    }, 300);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Não mostrar se não há update ou foi dispensado
  if (!hasUpdate || dismissed) {
    return null;
  }

  return (
    <div className={cn(
      "w-full bg-primary text-primary-foreground px-4 py-2",
      "flex items-center justify-center gap-3",
      "animate-in slide-in-from-top duration-300"
    )}>
      <span className="text-sm font-medium">
        ✨ Nova versão disponível!
      </span>
      
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs"
        onClick={handleUpdate}
        disabled={updating}
      >
        <RefreshCw className={cn("h-3 w-3 mr-1.5", updating && "animate-spin")} />
        {updating ? "Atualizando..." : "Atualizar Agora"}
      </Button>
      
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
