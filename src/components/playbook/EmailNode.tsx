import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";

interface EmailNodeData {
  label: string;
  subject?: string;
  template_id?: string;
}

export const EmailNode = memo(({ data }: { data: EmailNodeData }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Card className="px-4 py-3 bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            {data.subject && (
              <div className="text-xs text-muted-foreground mt-1">
                {data.subject}
              </div>
            )}
          </div>
        </div>
      </Card>
      <Handle type="source" position={Position.Right} />
    </>
  );
});

EmailNode.displayName = "EmailNode";
