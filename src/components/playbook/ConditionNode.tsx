import { memo } from "react";
import { Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ConditionNodeData {
  label: string;
  condition_type?: "email_opened" | "email_clicked" | "meeting_booked" | "tag_exists" | "status_change";
  condition_value?: string;
}

const conditionLabels = {
  email_opened: "Email Aberto",
  email_clicked: "Email Clicado",
  meeting_booked: "Reunião Agendada",
  tag_exists: "Tag Existe",
  status_change: "Mudança de Status",
};

export const ConditionNode = memo(({ data }: { data: ConditionNodeData }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Card className="px-4 py-3 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700 min-w-[220px]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <div className="flex-1">
              <div className="font-medium text-sm">{data.label}</div>
            </div>
          </div>
          {data.condition_type && (
            <div className="text-xs text-muted-foreground">
              Se: {conditionLabels[data.condition_type]}
            </div>
          )}
          {data.condition_value && (
            <div className="text-xs text-muted-foreground italic">
              "{data.condition_value}"
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t">
            <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
              ✓ Sim
            </Badge>
            <Badge variant="outline" className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
              ✗ Não
            </Badge>
          </div>
        </div>
      </Card>
      {/* Handle direito superior para o caminho "true" (Sim) */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="true"
        style={{ background: '#16a34a', top: '35%' }}
      />
      {/* Handle direito inferior para o caminho "false" (Não) */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="false"
        style={{ background: '#dc2626', top: '65%' }}
      />
    </>
  );
});

ConditionNode.displayName = "ConditionNode";
