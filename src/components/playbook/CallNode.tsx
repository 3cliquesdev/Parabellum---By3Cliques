import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Phone } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CallNodeData {
  label: string;
  description?: string;
}

export const CallNode = memo(({ data }: { data: CallNodeData }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Card className="px-4 py-3 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            {data.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {data.description}
              </div>
            )}
          </div>
        </div>
      </Card>
      <Handle type="source" position={Position.Right} />
    </>
  );
});

CallNode.displayName = "CallNode";
