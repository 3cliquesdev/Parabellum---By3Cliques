import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DelayNodeData {
  label: string;
  duration_days?: number;
}

export const DelayNode = memo(({ data }: { data: DelayNodeData }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Card className="px-4 py-3 bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700 min-w-[180px]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1">
            <div className="font-medium text-sm">{data.label}</div>
            {data.duration_days && (
              <div className="text-xs text-muted-foreground mt-1">
                {data.duration_days} {data.duration_days === 1 ? "dia" : "dias"}
              </div>
            )}
          </div>
        </div>
      </Card>
      <Handle type="source" position={Position.Right} />
    </>
  );
});

DelayNode.displayName = "DelayNode";
