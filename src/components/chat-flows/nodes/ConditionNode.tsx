import { memo } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface ConditionNodeData {
  label: string;
  condition_type: "contains" | "equals" | "regex" | "has_data";
  condition_field?: string;
  condition_value?: string;
}

const conditionLabels: Record<string, string> = {
  contains: "Contém",
  equals: "É igual a",
  regex: "Regex",
  has_data: "Tem dado",
  not_has_data: "Não tem dado",
  greater_than: "Maior que",
  less_than: "Menor que",
};

const friendlyFieldNames: Record<string, string> = {
  email: "Email",
  name: "Nome",
  phone: "Telefone",
  cpf: "CPF",
  "": "Mensagem do usuário",
};

export const ChatFlowConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeData>) => {
  const conditionType = data.condition_type || "contains";
  
  let subtitle = conditionLabels[conditionType] || conditionType;
  const fieldLabel = data.condition_field 
    ? (friendlyFieldNames[data.condition_field] || data.condition_field)
    : friendlyFieldNames[""];
  subtitle += ` (${fieldLabel})`;
  if (data.condition_value) {
    const supportsMulti = conditionType === "contains" || conditionType === "equals";
    if (supportsMulti) {
      const terms = data.condition_value.split(",").map(t => t.trim()).filter(Boolean);
      if (terms.length > 1) {
        const preview = terms.slice(0, 2).join(", ");
        subtitle += `: "${preview}, ..." (${terms.length} termos)`;
      } else {
        subtitle += `: "${data.condition_value}"`;
      }
    } else {
      subtitle += `: "${data.condition_value}"`;
    }
  }
  
  return (
    <ChatFlowNodeWrapper
      type="condition"
      icon={GitBranch}
      title={data.label || "Condição"}
      subtitle={subtitle}
      selected={selected}
      showSourceHandle={false}
      customHandles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="!w-4 !h-4 !bg-primary !border-2 !border-background"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-4 !h-4 !border-2 !border-background"
            style={{ background: '#16a34a', top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="!w-4 !h-4 !border-2 !border-background"
            style={{ background: '#dc2626', top: '65%' }}
          />
        </>
      }
    >
      <div className="flex gap-2 mt-1">
        <Badge variant="outline" className="text-xs text-success border-success/50">
          ✓ Sim
        </Badge>
        <Badge variant="outline" className="text-xs text-destructive border-destructive/50">
          ✗ Não
        </Badge>
      </div>
    </ChatFlowNodeWrapper>
  );
});

ChatFlowConditionNode.displayName = "ChatFlowConditionNode";
