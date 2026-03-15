import { useClientReturns, STATUS_CONFIG } from "@/hooks/useClientReturns";
import { useReasonLabelsMap } from "@/hooks/useReturnReasons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, RotateCcw, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReturnsListProps {
  onRequestNew?: () => void;
}

export function ReturnsList({ onRequestNew }: ReturnsListProps) {
  const { data: returns, isLoading } = useClientReturns();
  const reasonLabels = useReasonLabelsMap();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!returns || returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <RotateCcw className="h-7 w-7 text-blue-600" />
        </div>
        <p className="font-semibold text-gray-900">Nenhuma devolução registrada</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Caso precise devolver algum produto, clique no botão abaixo para iniciar o processo.
        </p>
        {onRequestNew && (
          <Button size="sm" className="mt-4" onClick={onRequestNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            Solicitar Devolução
          </Button>
        )}
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
            className="client-portal-card border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all group cursor-default"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    Pedido {ret.external_order_id}
                  </p>
                  <Badge variant={statusCfg.variant} className="shrink-0 text-[11px]">
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {reasonLabels[ret.reason] || ret.reason}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                  <span>Protocolo: {ret.id.substring(0, 8).toUpperCase()}</span>
                  <span>•</span>
                  <span>
                    {format(new Date(ret.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-500 transition-colors shrink-0" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
