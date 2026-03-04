import { memo } from "react";
import { NodeProps } from "reactflow";
import { CheckCircle, Ticket, UserPlus, Tag } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface EndNodeData {
  label: string;
  message: string;
  end_action: "none" | "create_lead" | "create_ticket" | "add_tag" | "transfer";
  action_data?: {
    tag_id?: string;
    tag_name?: string;
    ticket_category?: string;
    department_id?: string;
  };
}

const actionConfig = {
  none: { icon: CheckCircle, label: "Apenas finalizar", color: "bg-green-500/10 text-green-700" },
  create_lead: { icon: UserPlus, label: "Criar Lead", color: "bg-blue-500/10 text-blue-700" },
  create_ticket: { icon: Ticket, label: "Criar Ticket", color: "bg-purple-500/10 text-purple-700" },
  add_tag: { icon: Tag, label: "Adicionar Tag", color: "bg-orange-500/10 text-orange-700" },
  transfer: { icon: UserPlus, label: "Transferir", color: "bg-cyan-500/10 text-cyan-700" },
};

export const EndNode = memo(({ data, selected }: NodeProps<EndNodeData>) => {
  const action = data.end_action || "none";
  const config = actionConfig[action] || actionConfig.none;
  const ActionIcon = config.icon;
  
  return (
    <ChatFlowNodeWrapper
      type="end"
      icon={CheckCircle}
      title={data.label || "Fim do Fluxo"}
      subtitle={data.message || "Obrigado pelo contato!"}
      selected={selected}
      showSourceHandle={false}
    >
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <Badge className={`text-xs flex items-center gap-1 ${config.color}`}>
          <ActionIcon className="h-3 w-3" />
          {config.label}
        </Badge>
        {action === "add_tag" && data.action_data?.tag_name && (
          <Badge variant="outline" className="text-xs">
            {data.action_data.tag_name}
          </Badge>
        )}
        {action === "add_tag" && data.action_data?.tag_scope && (
          <Badge variant="secondary" className="text-[10px]">
            {data.action_data.tag_scope === "conversation" ? "💬 Conversa" : "👤 Contato"}
          </Badge>
        )}
      </div>
    </ChatFlowNodeWrapper>
  );
});

EndNode.displayName = "EndNode";
