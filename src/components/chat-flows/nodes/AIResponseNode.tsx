import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Sparkles, Brain, Bot, BookOpen, ShoppingCart, Package, Wand2, Shield, MessageSquareOff, Target, RefreshCw, Hash, KeyRound, DollarSign, Store, Briefcase, Truck, RotateCcw, Wallet, Monitor, Globe } from "lucide-react";
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
  // 🆕 5 novos intents
  forbid_pedidos?: boolean;
  forbid_devolucao?: boolean;
  forbid_saque?: boolean;
  forbid_sistema?: boolean;
  forbid_internacional?: boolean;
  // 🆕 OTP inline
  require_otp_for_financial?: boolean;
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

  // 🆕 Custom handles: target (left) + 11 source handles (right) por intenção
  const customHandles = (
    <>
      {/* Target handle (entrada) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background"
      />
      {/* Source handle padrão */}
      <Handle type="source" position={Position.Right} id="default"
        className="!w-4 !h-4 !bg-primary !border-2 !border-background"
        style={{ top: '5%' }} />
      {/* Source handle financeiro */}
      <Handle type="source" position={Position.Right} id="financeiro"
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-background"
        style={{ top: '14%' }} />
      {/* Source handle cancelamento */}
      <Handle type="source" position={Position.Right} id="cancelamento"
        className="!w-4 !h-4 !bg-red-500 !border-2 !border-background"
        style={{ top: '23%' }} />
      {/* Source handle comercial */}
      <Handle type="source" position={Position.Right} id="comercial"
        className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-background"
        style={{ top: '32%' }} />
      {/* Source handle suporte */}
      <Handle type="source" position={Position.Right} id="suporte"
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-background"
        style={{ top: '41%' }} />
      {/* Source handle consultor */}
      <Handle type="source" position={Position.Right} id="consultor"
        className="!w-4 !h-4 !bg-violet-500 !border-2 !border-background"
        style={{ top: '50%' }} />
      {/* 🆕 Source handle pedidos */}
      <Handle type="source" position={Position.Right} id="pedidos"
        className="!w-4 !h-4 !bg-teal-500 !border-2 !border-background"
        style={{ top: '59%' }} />
      {/* 🆕 Source handle devolucao */}
      <Handle type="source" position={Position.Right} id="devolucao"
        className="!w-4 !h-4 !bg-orange-500 !border-2 !border-background"
        style={{ top: '68%' }} />
      {/* 🆕 Source handle saque */}
      <Handle type="source" position={Position.Right} id="saque"
        className="!w-4 !h-4 !bg-yellow-500 !border-2 !border-background"
        style={{ top: '77%' }} />
      {/* 🆕 Source handle suporte_sistema */}
      <Handle type="source" position={Position.Right} id="suporte_sistema"
        className="!w-4 !h-4 !bg-slate-500 !border-2 !border-background"
        style={{ top: '86%' }} />
      {/* 🆕 Source handle comercial_internacional */}
      <Handle type="source" position={Position.Right} id="comercial_internacional"
        className="!w-4 !h-4 !bg-cyan-500 !border-2 !border-background"
        style={{ top: data.require_otp_for_financial ? '73%' : '95%' }} />

      {/* 🆕 OTP conditional handles - only when require_otp_for_financial is enabled */}
      {data.require_otp_for_financial && (
        <>
          <Handle type="source" position={Position.Right} id="otp_verified"
            className="!w-4 !h-4 !bg-green-500 !border-2 !border-background"
            style={{ top: '84%' }} />
          <Handle type="source" position={Position.Right} id="otp_failed"
            className="!w-4 !h-4 !bg-red-500 !border-2 !border-background"
            style={{ top: '95%' }} />
        </>
      )}

      {/* Labels visuais */}
      <div className="absolute right-[-55px] text-[8px] text-muted-foreground font-medium pointer-events-none" style={{ top: '2%' }}>
        padrão
      </div>
      <div className="absolute right-[-70px] text-[8px] text-amber-600 font-medium pointer-events-none" style={{ top: '11%' }}>
        💰 financeiro
      </div>
      <div className="absolute right-[-80px] text-[8px] text-red-600 font-medium pointer-events-none" style={{ top: '20%' }}>
        ❌ cancelamento
      </div>
      <div className="absolute right-[-65px] text-[8px] text-emerald-600 font-medium pointer-events-none" style={{ top: '29%' }}>
        🛒 comercial
      </div>
      <div className="absolute right-[-60px] text-[8px] text-blue-600 font-medium pointer-events-none" style={{ top: '38%' }}>
        🧑 suporte
      </div>
      <div className="absolute right-[-65px] text-[8px] text-violet-600 font-medium pointer-events-none" style={{ top: '47%' }}>
        💼 consultor
      </div>
      <div className="absolute right-[-60px] text-[8px] text-teal-600 font-medium pointer-events-none" style={{ top: '56%' }}>
        📦 pedidos
      </div>
      <div className="absolute right-[-70px] text-[8px] text-orange-600 font-medium pointer-events-none" style={{ top: '65%' }}>
        🔄 devolução
      </div>
      <div className="absolute right-[-55px] text-[8px] text-yellow-600 font-medium pointer-events-none" style={{ top: data.require_otp_for_financial ? '51%' : '74%' }}>
        💰 saque
      </div>
      <div className="absolute right-[-60px] text-[8px] text-slate-600 font-medium pointer-events-none" style={{ top: data.require_otp_for_financial ? '62%' : '83%' }}>
        🖥️ sistema
      </div>
      <div className="absolute right-[-75px] text-[8px] text-cyan-600 font-medium pointer-events-none" style={{ top: data.require_otp_for_financial ? '70%' : '92%' }}>
        🌍 internacional
      </div>

      {/* 🆕 OTP Labels */}
      {data.require_otp_for_financial && (
        <>
          <div className="absolute right-[-65px] text-[8px] text-green-600 font-bold pointer-events-none" style={{ top: '81%' }}>
            ✅ OTP ok
          </div>
          <div className="absolute right-[-80px] text-[8px] text-red-600 font-bold pointer-events-none" style={{ top: '92%' }}>
            ❌ OTP falhou
          </div>
        </>
      )}
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

        {/* 🆕 Badge de Trava Pedidos */}
        {data.forbid_pedidos && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-teal-600/90">
            <Truck className="h-2.5 w-2.5" />
            Pedidos
          </Badge>
        )}

        {/* 🆕 Badge de Trava Devolução */}
        {data.forbid_devolucao && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-orange-600/90">
            <RotateCcw className="h-2.5 w-2.5" />
            Devolução
          </Badge>
        )}

        {/* 🆕 Badge de Trava Saque */}
        {data.forbid_saque && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-yellow-600/90">
            <Wallet className="h-2.5 w-2.5" />
            Saque
          </Badge>
        )}

        {/* 🆕 Badge de Trava Sistema */}
        {data.forbid_sistema && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-slate-600/90">
            <Monitor className="h-2.5 w-2.5" />
            Sistema
          </Badge>
        )}

        {/* 🆕 Badge de Trava Internacional */}
        {data.forbid_internacional && (
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-cyan-600/90">
            <Globe className="h-2.5 w-2.5" />
            Internacional
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
