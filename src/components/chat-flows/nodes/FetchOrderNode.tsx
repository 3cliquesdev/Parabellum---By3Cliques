import { memo } from "react";
import { NodeProps } from "reactflow";
import { Package } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";

interface FetchOrderNodeData {
  label: string;
  search_type: "auto" | "tracking" | "order_id";
  source_variable: string;
  save_found_as: string;
  save_status_as: string;
  save_packed_at_as: string;
}

export const FetchOrderNode = memo(({ data, selected }: NodeProps<FetchOrderNodeData>) => {
  const searchTypeLabels: Record<string, string> = {
    auto: "Detectar automaticamente",
    tracking: "Código de rastreio",
    order_id: "Número do pedido",
  };

  return (
    <ChatFlowNodeWrapper
      type="fetch_order"
      icon={Package}
      title={data.label || "Buscar Pedido"}
      subtitle={`Buscar por: ${searchTypeLabels[data.search_type || "auto"]}`}
      selected={selected}
    >
      {data.source_variable && (
        <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded">
          Fonte: <span className="font-mono">{`{{${data.source_variable}}}`}</span>
        </div>
      )}
    </ChatFlowNodeWrapper>
  );
});

FetchOrderNode.displayName = "FetchOrderNode";
