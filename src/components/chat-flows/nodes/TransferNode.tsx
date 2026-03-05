import { memo } from "react";
import { NodeProps } from "reactflow";
import { UserPlus, Building2, UserCheck } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface TransferNodeData {
  label: string;
  message: string;
  transfer_type: "department" | "agent" | "queue" | "consultant" | "preferred";
  department_id?: string;
  department_name?: string;
  agent_id?: string;
  agent_name?: string;
}

export const TransferNode = memo(({ data, selected }: NodeProps<TransferNodeData>) => {
  const transferType = data.transfer_type || "department";
  
  let targetLabel = "Não configurado";
  let TargetIcon = Building2;
  if (transferType === "preferred") {
    targetLabel = "Preferência do Contato";
    TargetIcon = UserCheck;
  } else if (transferType === "consultant") {
    targetLabel = "Meu Consultor";
    TargetIcon = UserCheck;
  } else if (transferType === "department" && data.department_name) {
    targetLabel = data.department_name;
  } else if (transferType === "agent" && data.agent_name) {
    targetLabel = data.agent_name;
  } else if (transferType === "queue") {
    targetLabel = "Fila de atendimento";
  }
  
  return (
    <ChatFlowNodeWrapper
      type="transfer"
      icon={UserPlus}
      title={data.label || "Transferir"}
      subtitle={data.message || "Transferindo para atendimento humano..."}
      selected={selected}
      showSourceHandle={false}
    >
      <div className="flex flex-col gap-1 mt-1">
        <Badge variant="outline" className="text-xs flex items-center gap-1">
          <TargetIcon className="h-3 w-3" />
          {targetLabel}
        </Badge>
        {(transferType === "consultant" || transferType === "preferred") && data.department_name && (
          <Badge variant="outline" className="text-[10px] flex items-center gap-1 text-muted-foreground">
            <Building2 className="h-2.5 w-2.5" />
            Fallback: {data.department_name}
          </Badge>
        )}
      </div>
    </ChatFlowNodeWrapper>
  );
});

TransferNode.displayName = "TransferNode";
