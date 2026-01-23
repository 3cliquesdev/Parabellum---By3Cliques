import { memo } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { ListChecks } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";

interface Option {
  id: string;
  label: string;
  value: string;
}

interface AskOptionsNodeData {
  label: string;
  message: string;
  options: Option[];
  save_as: string;
  allow_multiple: boolean;
}

// Cores fixas para cada opção (mais visíveis e consistentes)
const optionColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// Função para calcular posição vertical dos handles (igual ao SwitchNode)
const getHandlePosition = (index: number, total: number) => {
  const startOffset = 30;
  const endOffset = 70;
  const range = endOffset - startOffset;
  
  if (total === 1) return 50;
  return startOffset + (index * range) / (total - 1);
};

export const AskOptionsNode = memo(({ data, selected }: NodeProps<AskOptionsNodeData>) => {
  const options = data.options || [];
  
  return (
    <ChatFlowNodeWrapper
      type="ask_options"
      icon={ListChecks}
      title={data.label || "Múltipla Escolha"}
      subtitle={data.message || "Selecione uma opção"}
      selected={selected}
      showSourceHandle={false}
      customHandles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="!w-4 !h-4 !bg-primary !border-2 !border-background"
          />
          {/* Handle para cada opção - tamanho maior e posição corrigida */}
          {options.map((option, idx) => (
            <Handle
              key={option.id}
              type="source"
              position={Position.Right}
              id={option.id}
              className="!w-4 !h-4 !border-2 !border-background cursor-crosshair"
              style={{ 
                background: optionColors[idx % optionColors.length],
                top: `${getHandlePosition(idx, options.length)}%`
              }}
            />
          ))}
          {/* Fallback handle se não houver opções */}
          {options.length === 0 && (
            <Handle
              type="source"
              position={Position.Right}
              id="default"
              className="!w-4 !h-4 !bg-muted-foreground !border-2 !border-background"
              style={{ top: '50%' }}
            />
          )}
        </>
      }
    >
      {/* Visual que corresponde às cores dos handles */}
      <div className="space-y-1.5">
        {options.map((option, idx) => (
          <div 
            key={option.id} 
            className="flex items-center gap-2 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: `${optionColors[idx % optionColors.length]}15` }}
          >
            <div 
              className="w-2.5 h-2.5 rounded-full shrink-0" 
              style={{ backgroundColor: optionColors[idx % optionColors.length] }}
            />
            <span 
              className="font-medium truncate"
              style={{ color: optionColors[idx % optionColors.length] }}
            >
              {option.label || "Sem rótulo"}
            </span>
          </div>
        ))}
        {options.length === 0 && (
          <div className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
            Configure as opções no painel lateral
          </div>
        )}
      </div>
    </ChatFlowNodeWrapper>
  );
});

AskOptionsNode.displayName = "AskOptionsNode";
