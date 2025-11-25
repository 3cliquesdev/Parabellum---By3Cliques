import { memo } from "react";
import { Handle, Position } from "reactflow";
import { CheckSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

interface TaskNodeData {
  label: string;
  task_type?: string;
  description?: string;
}

export const TaskNode = memo(({ data }: { data: TaskNodeData }) => {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Card className="px-4 py-3 bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 min-w-[200px]">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
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

TaskNode.displayName = "TaskNode";
