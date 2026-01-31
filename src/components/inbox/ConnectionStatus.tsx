import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Indicador visual de status da conexão Realtime
 * 
 * Estados:
 * - 🟢 Online (isHealthy): Conectado e recebendo eventos
 * - 🟡 Sincronizando (isDegraded): Conectado mas sem eventos recentes
 * - 🔴 Reconectando (!isConnected): Desconectado
 */
export function ConnectionStatus({ className, showLabel = true }: ConnectionStatusProps) {
  const { isConnected, isHealthy, isDegraded, forceReconnect } = useRealtimeHealth();
  
  if (isHealthy) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Wifi className="h-3 w-3 text-green-500" />
        {showLabel && <span>Online</span>}
      </div>
    );
  }
  
  if (isDegraded) {
    return (
      <button
        onClick={forceReconnect}
        className={cn(
          "flex items-center gap-1 text-xs text-yellow-600 hover:underline transition-colors",
          className
        )}
        title="Clique para forçar sincronização"
      >
        <AlertTriangle className="h-3 w-3" />
        {showLabel && <span>Sincronizando...</span>}
      </button>
    );
  }
  
  return (
    <button
      onClick={forceReconnect}
      className={cn(
        "flex items-center gap-1 text-xs text-destructive hover:underline transition-colors",
        className
      )}
      title="Clique para reconectar"
    >
      <WifiOff className="h-3 w-3" />
      {showLabel && <span>Reconectando...</span>}
      <RefreshCw className="h-3 w-3 animate-spin" />
    </button>
  );
}
