import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SandboxMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: any[];
  timestamp: Date;
}

export interface SandboxResponse {
  content: string;
  tool_calls: any[];
  persona: {
    name: string;
    role: string;
    temperature: number;
  };
  debug: {
    model: string;
    ai_provider: string;
    intent_classification: string;
    queries_executed: string[];
    knowledge_search_performed: boolean;
    semantic_search_used: boolean;
    articles_found: number;
    articles: Array<{ id: string; title: string; category: string; similarity?: string }>;
    persona_categories: string[];
    handoff_triggered: boolean;
    handoff_reason: string;
    execution_time_ms: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const useSandboxChat = () => {
  const [messages, setMessages] = useState<SandboxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(false);
  const [aiProvider, setAiProvider] = useState<'lovable' | 'openai'>('lovable');

  const sendMessage = async (content: string, personaId: string) => {
    if (!content.trim() || !personaId) return;

    // Add user message
    const userMessage: SandboxMessage = {
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('sandbox-chat', {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          personaId,
          useKnowledgeBase,
          aiProvider,
        },
      });

      if (error) throw error;

      const response = data as SandboxResponse;

      // Add assistant message
      const assistantMessage: SandboxMessage = {
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setDebugInfo(response.debug);

    } catch (error: any) {
      console.error('Sandbox chat error:', error);
      toast.error(error.message || 'Erro ao processar mensagem');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setDebugInfo(null);
  };

  return {
    messages,
    isLoading,
    debugInfo,
    sendMessage,
    clearChat,
    useKnowledgeBase,
    setUseKnowledgeBase,
    aiProvider,
    setAiProvider,
  };
};
