import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Olá! Posso te ajudar com pedidos, rastreio, dúvidas ou devoluções. O que você precisa?",
  timestamp: new Date(),
};

export function useClientAssistant() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  // Buscar contact_id pelo email
  const { data: contactId } = useQuery({
    queryKey: ["assistant-contact-id", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("email", user.email)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
  });

  // Buscar persona do portal por nome (dinâmico, sem UUID hardcoded)
  const { data: portalPersona } = useQuery({
    queryKey: ["portal-persona"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_personas")
        .select("id, system_prompt")
        .eq("name", "Portal Cliente")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  // Fallback para UUID legado se persona não encontrada por nome
  const PORTAL_PERSONA_ID = portalPersona?.id || "d4dc2026-bb47-4f2c-b675-b8d301240786";

  const invokeAssistant = useCallback(async (conversationId: string, messageText: string, contactName: string) => {
    const { data, error } = await supabase.functions.invoke("ai-autopilot-chat", {
      body: {
        conversationId,
        customerMessage: messageText,
        customer_context: {
          name: contactName,
          email: user?.email,
          isVerified: true,
        },
        flow_context: {
          node_type: "ai_response",
          personaId: PORTAL_PERSONA_ID,
          allowed_sources: ["kb", "crm", "tracking"],
          contextPrompt:
            "[ROLE: especialista] Você é a assistente virtual do portal do cliente da 3Cliques. Responda dúvidas sobre pedidos, rastreio, devoluções e financeiro. Você TEM acesso à ferramenta check_tracking — use-a quando o cliente perguntar sobre status de pedido ou entrega. Use a base de conhecimento para dúvidas gerais. Seja direta, acolhedora e objetiva.",
          forbidQuestions: false,
          forbidOptions: false,
          maxSentences: 4,
          useKnowledgeBase: true,
        },
      },
    });

    if (error) throw error;
    return data;
  }, [user?.email]);

  const isConversationStillActive = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, status, ai_mode")
      .eq("id", conversationId)
      .maybeSingle();

    if (error || !data) {
      console.warn("[AssistantWidget] Conversa inválida, criando nova:", conversationId, error);
      return false;
    }

    return data.status !== "closed" && data.ai_mode !== "disabled";
  }, []);

  const getOrCreateConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) {
      const isActive = await isConversationStillActive(conversationIdRef.current);
      if (isActive) return conversationIdRef.current;
      conversationIdRef.current = null;
    }

    if (!contactId?.id) throw new Error("Contato não encontrado");

    // Buscar conversa ativa web_chat
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId.id)
      .eq("channel", "web_chat")
      .neq("status", "closed")
      .neq("ai_mode", "disabled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      conversationIdRef.current = existing.id;
      return existing.id;
    }

    // Criar nova conversa
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        contact_id: contactId.id,
        channel: "web_chat",
        status: "open",
        ai_mode: "autopilot",
      })
      .select("id")
      .single();

    if (error) throw error;
    conversationIdRef.current = newConv.id;
    return newConv.id;
  }, [contactId, isConversationStillActive]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || isLoading || handoff) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const contactName = contactId
        ? `${contactId.first_name} ${contactId.last_name}`.trim()
        : profile?.full_name || user?.email?.split("@")[0] || "Cliente";

      let conversationId = await getOrCreateConversation();
      let data = await invokeAssistant(conversationId, trimmedText, contactName);

      if (data?.skipped === true && data?.ai_mode === "disabled") {
        console.warn("[AssistantWidget] Conversa desabilitada detectada, recriando atendimento", conversationId);
        conversationIdRef.current = null;
        conversationId = await getOrCreateConversation();
        data = await invokeAssistant(conversationId, trimmedText, contactName);
      }

      const aiText = data?.response || data?.message || "Desculpe, não consegui processar sua solicitação. Tente novamente.";

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (data?.handoff === true) {
        setHandoff(true);
        const handoffMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Vou conectar você com nossa equipe. Um momento!",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, handoffMsg]);
      }
    } catch (err: any) {
      console.error("Erro ao enviar mensagem:", err);
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, handoff, getOrCreateConversation, invokeAssistant, contactId, profile, user]);

  return {
    messages,
    isLoading,
    handoff,
    sendMessage,
    contactReady: !!contactId?.id,
  };
}
