import { memo } from "react";
import { Mail, AlertCircle } from "lucide-react";
import { WorkflowNodeWrapper } from "./WorkflowNodeWrapper";
import { NodeProps } from "reactflow";

interface EmailNodeData {
  label: string;
  subject?: string;
  template_id?: string;
}

export const EmailNode = memo(({ data, selected }: NodeProps<EmailNodeData>) => {
  const hasTemplate = !!data.template_id;

  return (
    <WorkflowNodeWrapper
      type="email"
      icon={Mail}
      title={data.label}
      subtitle={data.subject ? `Assunto: ${data.subject}` : undefined}
      selected={selected}
      hasError={!hasTemplate}
    >
      {!hasTemplate && (
        <div className="flex items-center gap-1 text-destructive text-xs font-medium bg-destructive/10 px-2 py-1 rounded">
          <AlertCircle className="h-3 w-3" />
          Template não configurado
        </div>
      )}
    </WorkflowNodeWrapper>
  );
});

EmailNode.displayName = "EmailNode";
