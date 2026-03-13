import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Sparkles, Brain, Bot, BookOpen, ShoppingCart, Package, Wand2, Shield, MessageSquareOff, Target, RefreshCw, Hash, KeyRound, DollarSign, Store, Briefcase } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";
import { Badge } from "@/components/ui/badge";

interface AIResponseNodeData {
  label: string;
  context_prompt?: string;
  use_knowledge_base: boolean;
  fallback_message?: string;
  persona_id?: string;
  persona_name?: string;
  kb_categories?: string[];
  use_customer_data?: boolean;
  use_order_history?: boolean;
  use_tracking?: boolean;
  smart_collection_enabled?: boolean;
  smart_collection_fields?: string[];
  objective?: string;
  max_sentences?: number;
  forbid_questions?: boolean;
  forbid_options?: boolean;
  forbid_financial?: boolean;
  // 🆕 Modo Persistente
  ai_persistent?: boolean;
  max_ai_interactions?: number;
  exit_keywords?: string[];
  forbid_commercial?: boolean;
  forbid_cancellation?: boolean;
  forbid_support?: boolean;
  forbid_consultant?: boolean;
}

export const AIResponseNode = memo(({ data, selected }: NodeProps<AIResponseNodeData>) => {
  // Subtitle dinâmico baseado nas configurações
  const getSubtitle = () => {
    // Priorizar objetivo se definido
    if (data.objective) {
      return `🎯 ${data.objective.slice(0, 35)}${data.objective.length > 35 ? '...' : ''}`;
    }
    if (data.persona_name) {
      return `Persona: ${data.persona_name}`;
    }
    if (data.context_prompt) {
      return `Contexto: ${data.context_prompt.slice(0, 30)}...`;
    }
    return "Usar IA para responder";
  };

  // Verificar restrições ativas
  const forbidQuestions = data.forbid_questions ?? true;
  const forbidOptions = data.forbid_options ?? true;
  const maxSentences = data.max_sentences ?? 3;
  const hasRestrictions = forbidQuestions || forbidOptions;

  // 🆕 Custom handles: target (left) + 6 source handles (right) por intenção
  const customHandles = (
    <>
      {/* Target handle (entrada) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background"
      />
      {/* Source handle padrão */}
      <Handle
        type="source"
        position={Position.Right}
        id="default"
        className="!w-4 !h-4 !bg-primary !border-2 !border-background"
        style={{ top: '12%' }}
      />
      {/* Source handle financeiro */}
      <Handle
        type="source"
        position={Position.Right}
        id="financeiro"
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-background"
        style={{ top: '27%' }}
      />
      {/* Source handle cancelamento */}
      <Handle
        type="source"
        position={Position.Right}
        id="cancelamento"
        className="!w-4 !h-4 !bg-red-500 !border-2 !border-background"
        style={{ top: '42%' }}
      />
      {/* Source handle comercial */}
      <Handle
        type="source"
        position={Position.Right}
        id="comercial"
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-background"
        style={{ top: '57%' }}
      />
      {/* Source handle suporte */}
      <Handle
        type="source"
        position={Position.Right}
        id="suporte"
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-background"
        style={{ top: '72%' }}
      />
      {/* Source handle consultor */}
      <Handle
        type="source"
        position={Position.Right}
        id="consultor"
        className="!w-4 !h-4 !bg-violet-500 !border-2 !border-background"
        style={{ top: '87%' }}
      />
      {/* Labels visuais */}
      <div className="absolute right-[-55px] text-[8px] text-muted-foreground font-medium pointer-events-none" style={{ top: '5%' }}>
        padrão
      </div>
      <div className="absolute right-[-70px] text-[8px] text-amber-600 font-medium pointer-events-none" style={{ top: '20%' }}>
        💰 financeiro
      </div>
      <div className="absolute right-[-80px] text-[8px] text-red-600 font-medium pointer-events-none" style={{ top: '35%' }}>
        ❌ cancelamento
      </div>
      <div className="absolute right-[-65px] text-[8px] text-emerald-600 font-medium pointer-events-none" style={{ top: '50%' }}>
        🛒 comercial
      </div>
      <div className="absolute right-[-60px] text-[8px] text-blue-600 font-medium pointer-events-none" style={{ top: '65%' }}>
        🧑 suporte
      </div>
      <div className="absolute right-[-65px] text-[8px] text-violet-600 font-medium pointer-events-none" style={{ top: '80%' }}>
        💼 consultor
      </div>
    </>
  );

  return (
    <ChatFlowNodeWrapper
      type="ai_response"
      icon={Sparkles}
      title={data.label || "Resposta IA"}
      subtitle={getSubtitle()}
      selected={selected}
      customHandles={customHandles}
    >
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {/* 🆕 Badge de Objetivo definido */}
        {data.objective && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-purple-500/90">
            <Target className="h-2.5 w-2.5" />
            Objetivo
          </Badge>
        )}

        {/* 🆕 Badge de Restrições ativas */}
        {hasRestrictions && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 gap-0.5">
            <Shield className="h-2.5 w-2.5" />
            {maxSentences}f
          </Badge>
        )}
        
        {/* Badge de Persona selecionada */}
        {data.persona_name && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-pink-500/90">
            <Bot className="h-2.5 w-2.5" />
            {data.persona_name.slice(0, 10)}
          </Badge>
        )}
        
        {/* Badge de KB ativa */}
        {data.use_knowledge_base !== false && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-0.5">
            <Brain className="h-2.5 w-2.5" />
            KB
          </Badge>
        )}
        
        {/* Badge de categorias filtradas */}
        {data.kb_categories && data.kb_categories.length > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5">
            <BookOpen className="h-2.5 w-2.5" />
            {data.kb_categories.length}
          </Badge>
        )}

        {/* Badge de CRM/Kiwify ativo */}
        {data.use_customer_data && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 border-green-500/50 text-green-600">
            <ShoppingCart className="h-2.5 w-2.5" />
            CRM
          </Badge>
        )}

        {/* Badge de Tracking ativo */}
        {data.use_tracking && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 border-orange-500/50 text-orange-600">
            <Package className="h-2.5 w-2.5" />
            Track
          </Badge>
        )}

        {/* Badge de Coleta Inteligente */}
        {data.smart_collection_enabled && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 border-amber-500/50 text-amber-600">
            <Wand2 className="h-2.5 w-2.5" />
            Coleta
          </Badge>
        )}
        
        {/* 🆕 Badge de Modo Persistente (Loop) */}
        {data.ai_persistent !== false && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 border-indigo-500/50 text-indigo-600">
            <RefreshCw className="h-2.5 w-2.5" />
            Loop
          </Badge>
        )}

        {/* 🆕 Badge Max Interações */}
        {(data.max_ai_interactions ?? 0) > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 border-indigo-500/50 text-indigo-600">
            <Hash className="h-2.5 w-2.5" />
            Max {data.max_ai_interactions}
          </Badge>
        )}

        {/* 🆕 Badge Keywords de saída */}
        {data.exit_keywords && data.exit_keywords.length > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 border-indigo-500/50 text-indigo-600">
            <KeyRound className="h-2.5 w-2.5" />
            {data.exit_keywords.length}
          </Badge>
        )}

        {/* Badge de Trava Financeira */}
        {data.forbid_financial && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 gap-0.5">
            <DollarSign className="h-2.5 w-2.5" />
            Sem financeiro
          </Badge>
        )}

        {/* Badge de Trava Comercial */}
        {data.forbid_commercial && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-green-600/90">
            <Store className="h-2.5 w-2.5" />
            Comercial
          </Badge>
        )}

        {/* Badge de Trava Cancelamento */}
        {data.forbid_cancellation && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 gap-0.5">
            ❌ Cancelamento
          </Badge>
        )}

        {/* Badge de Trava Suporte */}
        {data.forbid_support && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-blue-600/90">
            🧑 Suporte
          </Badge>
        )}

        {/* Badge de Trava Consultor */}
        {data.forbid_consultant && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-violet-600/90">
            <Briefcase className="h-2.5 w-2.5" />
            Consultor
          </Badge>
        )}

        {/* Badge de fallback configurado */}
        {data.fallback_message && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 opacity-60">
            fallback
          </Badge>
        )}
      </div>
    </ChatFlowNodeWrapper>
  );
});

AIResponseNode.displayName = "AIResponseNode";
