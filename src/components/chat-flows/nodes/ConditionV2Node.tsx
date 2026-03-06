import { memo } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { GitMerge } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface ConditionRule {
  id: string;
  label: string;
  keywords: string;
  field?: string;
  check_type?: string;
}

interface ConditionV2NodeData {
  label: string;
  condition_rules?: ConditionRule[];
}

const friendlyFieldNames: Record<string, string> = {
  email: "Email",
  name: "Nome",
  phone: "Telefone",
  cpf: "CPF",
  "": "Mensagem do usuário",
  consultant_id: "Tem Consultor?",
  is_customer: "É Cliente?",
  organization_id: "Tem Organização?",
};

const ruleColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// Each rule gets a pair of handles (Sim/Não), plus one "Outros" at the end
const getHandlePosition = (index: number, total: number) => {
  const startOffset = 12;
  const endOffset = 88;
  const range = endOffset - startOffset;
  if (total === 1) return 50;
  return startOffset + (index * range) / (total - 1);
};

export const ConditionV2Node = memo(({ data, selected }: NodeProps<ConditionV2NodeData>) => {
  const rules = data.condition_rules || [];

  if (rules.length === 0) {
    return (
      <ChatFlowNodeWrapper
        type="condition_v2"
        icon={GitMerge}
        title={data.label || "Condição V2"}
        subtitle="Nenhuma regra configurada"
        selected={selected}
      >
        <p className="text-xs text-muted-foreground italic">
          Adicione regras no painel lateral
        </p>
      </ChatFlowNodeWrapper>
    );
  }

  // Total handles: 2 per rule (sim + não) + 1 else
  const totalHandles = rules.length * 2 + 1;

  return (
    <ChatFlowNodeWrapper
      type="condition_v2"
      icon={GitMerge}
      title={data.label || "Condição V2"}
      subtitle={`${rules.length} regras (Sim/Não)`}
      selected={selected}
      showSourceHandle={false}
      customHandles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="!w-4 !h-4 !bg-primary !border-2 !border-background"
          />
          {rules.map((rule, idx) => {
            const simIdx = idx * 2;
            const naoIdx = idx * 2 + 1;
            return (
              <span key={rule.id}>
                {/* Sim handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={rule.id}
                  className="!w-4 !h-4 !border-2 !border-background cursor-crosshair"
                  style={{
                    background: '#16a34a',
                    top: `${getHandlePosition(simIdx, totalHandles)}%`,
                  }}
                />
                {/* Não handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`${rule.id}_false`}
                  className="!w-4 !h-4 !border-2 !border-background cursor-crosshair"
                  style={{
                    background: '#dc2626',
                    top: `${getHandlePosition(naoIdx, totalHandles)}%`,
                  }}
                />
              </span>
            );
          })}
          {/* Handle "Outros" (else) */}
          <Handle
            type="source"
            position={Position.Right}
            id="else"
            className="!w-4 !h-4 !border-2 !border-background cursor-crosshair"
            style={{
              background: '#6b7280',
              top: `${getHandlePosition(rules.length * 2, totalHandles)}%`,
            }}
          />
        </>
      }
    >
      <div className="space-y-1.5">
        {rules.map((rule, idx) => (
          <div key={rule.id} className="space-y-0.5">
            <div
              className="flex items-center gap-2 px-2 py-1 rounded text-xs"
              style={{ backgroundColor: `${ruleColors[idx % ruleColors.length]}15` }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ruleColors[idx % ruleColors.length] }}
              />
              <span
                className="font-medium truncate flex-1"
                style={{ color: ruleColors[idx % ruleColors.length] }}
              >
                {rule.field
                  ? `🔍 ${friendlyFieldNames[rule.field] || rule.field}`
                  : (rule.label || "Sem rótulo")}
              </span>
              <div className="flex gap-1 shrink-0">
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-success border-success/50">
                  ✓
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-destructive border-destructive/50">
                  ✗
                </Badge>
              </div>
            </div>
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
});

ConditionV2Node.displayName = "ConditionV2Node";
