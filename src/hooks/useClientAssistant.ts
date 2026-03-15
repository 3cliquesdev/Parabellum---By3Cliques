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

  const getOrCreateConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current;

    if (!contactId?.id) throw new Error("Contato não encontrado");

    // Buscar conversa ativa web_chat
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId.id)
      .eq("channel", "web_chat")
      .neq("status", "closed")
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
  }, [contactId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || handoff) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const conversationId = await getOrCreateConversation();

      const contactName = contactId
        ? `${contactId.first_name} ${contactId.last_name}`.trim()
        : profile?.full_name || user?.email?.split("@")[0] || "Cliente";

      const { data, error } = await supabase.functions.invoke("ai-autopilot-chat", {
        body: {
          conversationId,
          customerMessage: text.trim(),
          customer_context: {
            name: contactName,
            email: user?.email,
            isVerified: true,
          },
          flow_context: {
            node_type: "ai_response",
            allowed_sources: ["kb", "crm", "tracking"],
            contextPrompt:
              "[ROLE: especialista] Você é um assistente do portal do cliente. Responda dúvidas sobre pedidos, rastreio, devoluções e financeiro. Use a base de conhecimento. Seja direto e objetivo.",
            forbidQuestions: false,
            forbidOptions: false,
            maxSentences: 4,
          },
        },
      });

      if (error) throw error;

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
  }, [isLoading, handoff, getOrCreateConversation, contactId, profile, user]);

  return {
    messages,
    isLoading,
    handoff,
    sendMessage,
    contactReady: !!contactId?.id,
  };
}
