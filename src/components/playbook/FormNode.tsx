import { memo } from "react";
import { NodeProps } from "reactflow";
import { FileText } from "lucide-react";
import { WorkflowNodeWrapper } from "./WorkflowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface FormNodeData {
  label: string;
  form_id?: string;
  form_name?: string;
  pause_execution: boolean;
  timeout_days?: number;
}

export const FormNode = memo(({ data, selected }: NodeProps<FormNodeData>) => {
  const subtitle = data.form_name 
    ? `Formulário: ${data.form_name}` 
    : "Nenhum formulário selecionado";

  return (
    <WorkflowNodeWrapper
      type="form"
      icon={FileText}
      title={data.label}
      subtitle={subtitle}
      selected={selected}
    >
      <div className="flex flex-wrap gap-1">
        {data.pause_execution && (
          <Badge variant="secondary" className="text-xs">
            ⏸️ Pausa até resposta
          </Badge>
        )}
        {data.timeout_days && (
          <Badge variant="outline" className="text-xs">
            ⏰ {data.timeout_days} dias timeout
          </Badge>
        )}
      </div>
    </WorkflowNodeWrapper>
  );
});

FormNode.displayName = "FormNode";
