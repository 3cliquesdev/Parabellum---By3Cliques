import { useClientReturns, REASON_LABELS, STATUS_CONFIG } from "@/hooks/useClientReturns";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ReturnsList() {
  const { data: returns, isLoading } = useClientReturns();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!returns || returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RotateCcw className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">Nenhuma devolução registrada</p>
        <p className="text-sm text-muted-foreground mt-1">
          Use o botão acima para solicitar uma devolução
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {returns.map((ret) => {
        const statusCfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending;
        return (
          <div
            key={ret.id}
            className="border border-border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    Pedido {ret.external_order_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {REASON_LABELS[ret.reason] || ret.reason}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Protocolo: {ret.id.substring(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(ret.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <Badge variant={statusCfg.variant} className="shrink-0">
                {statusCfg.label}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
