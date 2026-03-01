import { memo } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface ConditionRule {
  id: string;
  label: string;
  keywords: string;
}

interface ConditionNodeData {
  label: string;
  condition_type: "contains" | "equals" | "regex" | "has_data" | "inactivity";
  condition_field?: string;
  condition_value?: string;
  condition_rules?: ConditionRule[];
}

const conditionLabels: Record<string, string> = {
  contains: "Contém",
  equals: "É igual a",
  regex: "Regex",
  has_data: "Tem dado",
  not_has_data: "Não tem dado",
  greater_than: "Maior que",
  less_than: "Menor que",
  inactivity: "Inatividade",
};

const friendlyFieldNames: Record<string, string> = {
  email: "Email",
  name: "Nome",
  phone: "Telefone",
  cpf: "CPF",
  "": "Mensagem do usuário",
  consultant_id: "Tem Consultor?",
};

// Cores fixas para cada regra (mesmas do AskOptionsNode)
const ruleColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// Posição vertical dos handles
const getHandlePosition = (index: number, total: number) => {
  const startOffset = 25;
  const endOffset = 75;
  const range = endOffset - startOffset;
  if (total === 1) return 50;
  return startOffset + (index * range) / (total - 1);
};

export const ChatFlowConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeData>) => {
  const conditionType = data.condition_type || "contains";
  const rules = data.condition_rules;
  const hasMultiRules = rules && rules.length > 0;

  // === MODO MULTI-REGRA ===
  if (hasMultiRules) {
    const totalHandles = rules.length + 1; // regras + else

    return (
      <ChatFlowNodeWrapper
        type="condition"
        icon={GitBranch}
        title={data.label || "Condição"}
        subtitle={`${rules.length} regras configuradas`}
        selected={selected}
        showSourceHandle={false}
        customHandles={
          <>
            <Handle
              type="target"
              position={Position.Left}
              className="!w-4 !h-4 !bg-primary !border-2 !border-background"
            />
            {rules.map((rule, idx) => (
              <Handle
                key={rule.id}
                type="source"
                position={Position.Right}
                id={rule.id}
                className="!w-4 !h-4 !border-2 !border-background cursor-crosshair"
                style={{
                  background: ruleColors[idx % ruleColors.length],
                  top: `${getHandlePosition(idx, totalHandles)}%`,
                }}
              />
            ))}
            {/* Handle "Outros" (else) */}
            <Handle
              type="source"
              position={Position.Right}
              id="else"
              className="!w-4 !h-4 !border-2 !border-background cursor-crosshair"
              style={{
                background: '#6b7280',
                top: `${getHandlePosition(rules.length, totalHandles)}%`,
              }}
            />
          </>
        }
      >
        <div className="space-y-1.5">
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className="flex items-center gap-2 px-2 py-1 rounded text-xs"
              style={{ backgroundColor: `${ruleColors[idx % ruleColors.length]}15` }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ruleColors[idx % ruleColors.length] }}
              />
              <span
                className="font-medium truncate"
                style={{ color: ruleColors[idx % ruleColors.length] }}
              >
                {rule.label || "Sem rótulo"}
              </span>
            </div>
          ))}
          {/* Else */}
          <div className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-muted/50">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/50" />
            <span className="font-medium truncate text-muted-foreground">Outros</span>
          </div>
        </div>
      </ChatFlowNodeWrapper>
    );
  }

  // === MODO CLÁSSICO (Sim/Não) ===
  let subtitle = conditionLabels[conditionType] || conditionType;
  
  // Inatividade: subtitle especial
  if (conditionType === 'inactivity') {
    const minutes = data.condition_value || '?';
    subtitle = `⏱ Inativo há ${minutes} min`;
  } else {
  const fieldLabel = data.condition_field
    ? (friendlyFieldNames[data.condition_field] || data.condition_field)
    : friendlyFieldNames[""];
  subtitle += ` (${fieldLabel})`;
  if (data.condition_value) {
    const supportsMulti = conditionType === "contains" || conditionType === "equals";
    if (supportsMulti) {
      const terms = data.condition_value.split(",").map(t => t.trim()).filter(Boolean);
      if (terms.length > 1) {
        const preview = terms.slice(0, 2).join(", ");
        subtitle += `: "${preview}, ..." (${terms.length} termos)`;
      } else {
        subtitle += `: "${data.condition_value}"`;
      }
    } else {
      subtitle += `: "${data.condition_value}"`;
    }
  }
  } // close else for non-inactivity

  return (
    <ChatFlowNodeWrapper
      type="condition"
      icon={GitBranch}
      title={data.label || "Condição"}
      subtitle={subtitle}
      selected={selected}
      showSourceHandle={false}
      customHandles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="!w-4 !h-4 !bg-primary !border-2 !border-background"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-4 !h-4 !border-2 !border-background"
            style={{ background: '#16a34a', top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="!w-4 !h-4 !border-2 !border-background"
            style={{ background: '#dc2626', top: '65%' }}
          />
        </>
      }
    >
      <div className="flex gap-2 mt-1">
        <Badge variant="outline" className="text-xs text-success border-success/50">
          ✓ Sim
        </Badge>
        <Badge variant="outline" className="text-xs text-destructive border-destructive/50">
          ✗ Não
        </Badge>
      </div>
    </ChatFlowNodeWrapper>
  );
});

ChatFlowConditionNode.displayName = "ChatFlowConditionNode";
