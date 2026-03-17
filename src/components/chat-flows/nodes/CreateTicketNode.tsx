import { memo } from "react";
import { NodeProps } from "reactflow";
import { Ticket } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";
import { useTicketCategories } from "@/hooks/useTicketCategories";

interface CreateTicketNodeData {
  label: string;
  subject_template: string;
  description_template: string;
  ticket_category: string;
  ticket_priority: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-green-500/10 text-green-700",
  medium: "bg-yellow-500/10 text-yellow-700",
  high: "bg-orange-500/10 text-orange-700",
  urgent: "bg-red-500/10 text-red-700",
};

export const CreateTicketNode = memo(({ data, selected }: NodeProps<CreateTicketNodeData>) => {
  const { data: categories = [] } = useTicketCategories();
  const category = data.ticket_category || "outro";
  const priority = data.ticket_priority || "medium";

  const categoryLabel = categories.find(c => c.name === category)?.name || category;

  return (
    <ChatFlowNodeWrapper
      type="create_ticket"
      icon={Ticket}
      title={data.label || "Criar Ticket"}
      subtitle={data.subject_template || "Assunto do ticket..."}
      selected={selected}
    >
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <Badge className={`text-[10px] ${priorityColors[priority] || priorityColors.medium}`}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {categoryLabel}
        </Badge>
      </div>
    </ChatFlowNodeWrapper>
  );
});

CreateTicketNode.displayName = "CreateTicketNode";
