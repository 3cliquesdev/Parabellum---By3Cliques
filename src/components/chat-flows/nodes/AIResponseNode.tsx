import { memo } from "react";
import { NodeProps } from "reactflow";
import { Sparkles, Brain, Bot, BookOpen } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface AIResponseNodeData {
  label: string;
  context_prompt?: string;
  use_knowledge_base: boolean;
  fallback_message?: string;
  // Novos campos para seleção de persona e KB
  persona_id?: string;
  persona_name?: string;
  kb_categories?: string[];
}

export const AIResponseNode = memo(({ data, selected }: NodeProps<AIResponseNodeData>) => {
  // Subtitle dinâmico baseado nas configurações
  const getSubtitle = () => {
    if (data.persona_name) {
      return `Persona: ${data.persona_name}`;
    }
    if (data.context_prompt) {
      return `Contexto: ${data.context_prompt.slice(0, 30)}...`;
    }
    return "Usar IA para responder";
  };

  return (
    <ChatFlowNodeWrapper
      type="ai_response"
      icon={Sparkles}
      title={data.label || "Resposta IA"}
      subtitle={getSubtitle()}
      selected={selected}
    >
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {/* Badge de Persona selecionada */}
        {data.persona_name && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 bg-pink-500/90">
            <Bot className="h-2.5 w-2.5" />
            {data.persona_name.slice(0, 12)}
          </Badge>
        )}
        
        {/* Badge de KB ativa */}
        {data.use_knowledge_base !== false && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <Brain className="h-2.5 w-2.5" />
            KB
          </Badge>
        )}
        
        {/* Badge de categorias filtradas */}
        {data.kb_categories && data.kb_categories.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <BookOpen className="h-2.5 w-2.5" />
            {data.kb_categories.length} cat.
          </Badge>
        )}
        
        {/* Badge de fallback configurado */}
        {data.fallback_message && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 opacity-70">
            fallback
          </Badge>
        )}
      </div>
    </ChatFlowNodeWrapper>
  );
});

AIResponseNode.displayName = "AIResponseNode";
