import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch, Flame, Thermometer, Snowflake } from "lucide-react";
import { WorkflowNodeWrapper } from "./WorkflowNodeWrapper";
import { Badge } from "@/components/ui/badge";

export interface SwitchCase {
  id: string;
  value: string;
  label: string;
  color: string;
  icon?: string;
}

export interface SwitchNodeData {
  label: string;
  switch_type: "lead_classification" | "form_field" | "custom";
  field_id?: string;
  field_name?: string;
  form_id?: string;
  form_name?: string;
  cases: SwitchCase[];
}

const defaultLeadClassificationCases: SwitchCase[] = [
  { id: "quente", value: "quente", label: "Quente", color: "#16a34a", icon: "flame" },
  { id: "morno", value: "morno", label: "Morno", color: "#d97706", icon: "thermometer" },
  { id: "frio", value: "frio", label: "Frio", color: "#dc2626", icon: "snowflake" },
];

const iconMap = {
  flame: Flame,
  thermometer: Thermometer,
  snowflake: Snowflake,
};

export const SwitchNode = memo(({ data, selected }: NodeProps<SwitchNodeData>) => {
  const cases = data.cases?.length > 0 ? data.cases : defaultLeadClassificationCases;
  const handleCount = cases.length;
  
  // Calculate vertical positions for handles
  const getHandlePosition = (index: number) => {
    const startOffset = 25; // Start from 25%
    const endOffset = 75; // End at 75%
    const range = endOffset - startOffset;
    
    if (handleCount === 1) return 50;
    return startOffset + (index * range) / (handleCount - 1);
  };

  return (
    <WorkflowNodeWrapper
      type="switch"
      icon={GitBranch}
      title={data.label}
      subtitle={
        data.switch_type === "lead_classification"
          ? "Roteamento por Classificação"
          : data.switch_type === "form_field"
          ? `Campo: ${data.field_name || "Não configurado"}`
          : "Switch Personalizado"
      }
      selected={selected}
      showSourceHandle={false}
      customHandles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="!w-4 !h-4 !bg-primary !border-2 !border-background"
          />
          {/* Multiple source handles based on cases */}
          {cases.map((caseItem, index) => (
            <Handle
              key={caseItem.id}
              type="source"
              position={Position.Right}
              id={caseItem.id}
              className="!w-4 !h-4 !border-2 !border-background"
              style={{ 
                background: caseItem.color, 
                top: `${getHandlePosition(index)}%` 
              }}
            />
          ))}
        </>
      }
    >
      {/* Visual representation of cases */}
      <div className="space-y-1.5">
        {cases.map((caseItem) => {
          const IconComponent = caseItem.icon ? iconMap[caseItem.icon as keyof typeof iconMap] : null;
          return (
            <div
              key={caseItem.id}
              className="flex items-center gap-2 px-2 py-1 rounded text-xs"
              style={{ backgroundColor: `${caseItem.color}15` }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: caseItem.color }}
              />
              {IconComponent && <IconComponent className="h-3 w-3" style={{ color: caseItem.color }} />}
              <span style={{ color: caseItem.color }} className="font-medium">
                {caseItem.label}
              </span>
            </div>
          );
        })}
      </div>
      
      {data.form_name && (
        <div className="flex items-center gap-2 mt-2 p-2 bg-blue-500/10 rounded text-xs">
          <span className="text-blue-600 font-medium">📋 {data.form_name}</span>
        </div>
      )}
    </WorkflowNodeWrapper>
  );
});

SwitchNode.displayName = "SwitchNode";
