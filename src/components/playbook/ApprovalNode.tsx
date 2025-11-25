import { memo } from "react";
import { Handle, Position } from "reactflow";
import { UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ApprovalNodeData {
  label: string;
  approver_role?: "consultant" | "manager" | "admin";
  approval_message?: string;
}

const roleLabels = {
  consultant: "Consultor",
  manager: "Gerente",
  admin: "Administrador",
};

export const ApprovalNode = memo(({ data }: { data: ApprovalNodeData }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Card className="px-4 py-3 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 min-w-[220px]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <div className="font-medium text-sm">{data.label}</div>
            </div>
          </div>
          <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
            ⏸️ Aguarda Aprovação
          </Badge>
          {data.approver_role && (
            <div className="text-xs text-muted-foreground">
              Aprovador: {roleLabels[data.approver_role]}
            </div>
          )}
          {data.approval_message && (
            <div className="text-xs text-muted-foreground italic border-t pt-2">
              "{data.approval_message}"
            </div>
          )}
        </div>
      </Card>
      <Handle type="source" position={Position.Right} />
    </>
  );
});

ApprovalNode.displayName = "ApprovalNode";
