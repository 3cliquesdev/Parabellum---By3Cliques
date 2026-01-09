import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";

interface CacheBusterProps {
  textColor?: string;
  buttonColor?: string;
}

export function CacheBuster({ textColor = "#ffffff", buttonColor = "#3b82f6" }: CacheBusterProps) {
  const [isClearing, setIsClearing] = useState(false);

  const clearCacheAndReload = async () => {
    setIsClearing(true);
    
    try {
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('[CacheBuster] Service workers unregistered');
      }

      // 2. Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[CacheBuster] Caches cleared:', cacheNames);
      }

      // 3. Force reload from server (bypass cache)
      window.location.reload();
    } catch (error) {
      console.error('[CacheBuster] Error clearing cache:', error);
      // Still try to reload even if cache clearing failed
      window.location.reload();
    }
  };

  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm opacity-60" style={{ color: textColor }}>
        Se este formulário deveria estar disponível, tente limpar o cache:
      </p>
      <Button
        onClick={clearCacheAndReload}
        disabled={isClearing}
        className="gap-2"
        style={{ 
          backgroundColor: buttonColor,
          color: "#ffffff"
        }}
      >
        {isClearing ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Limpando...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            Limpar cache e recarregar
          </>
        )}
      </Button>
    </div>
  );
}
