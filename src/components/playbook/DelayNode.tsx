import { memo } from "react";
import { Clock } from "lucide-react";
import { WorkflowNodeWrapper } from "./WorkflowNodeWrapper";
import { NodeProps } from "reactflow";
import { formatDelayDisplay, normalizeDelayData } from "@/lib/utils";

interface DelayNodeData {
  label: string;
  delay_type?: 'minutes' | 'hours' | 'days';
  delay_value?: number;
  duration_days?: number; // legacy fallback
}

export const DelayNode = memo(({ data, selected }: NodeProps<DelayNodeData>) => {
  const normalized = normalizeDelayData(data);
  const subtitle = formatDelayDisplay(normalized.delay_type, normalized.delay_value);

  return (
    <WorkflowNodeWrapper
      type="delay"
      icon={Clock}
      title={data.label}
      subtitle={subtitle}
      selected={selected}
    />
  );
});

DelayNode.displayName = "DelayNode";
