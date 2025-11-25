import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAutopilotTrigger } from "@/hooks/useAutopilotTrigger";

export default function PublicChatWindow() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const [isAITyping, setIsAITyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch } = useMessages(conversationId || "");
  
  // FASE 3: Ativar autopilot trigger (fallback se webhook falhar)
  useAutopilotTrigger(conversationId || null);

  // Carregar dados da conversa
  useEffect(() => {
    if (conversationId) {
      loadConversation();
    }
  }, [conversationId]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Realtime subscription para novas mensagens + AI typing indicator
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`public-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          // FASE 4: Controlar indicator "IA digitando..."
          if (newMsg.sender_type === 'contact') {
            setIsAITyping(true);
          }
          
          if (newMsg.sender_type === 'user') {
            setIsAITyping(false);
          }
          
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, refetch]);

  const loadConversation = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        contacts(*),
        department_data:departments!department(id, name, color)
      `)
      .eq("id", conversationId)
      .single();

    if (error) {
      toast({
        title: "Erro ao carregar conversa",
        description: error.message,
        variant: "destructive",
      });
      navigate("/public-chat");
      return;
    }

    setConversation(data);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !conversationId || isSending) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          content: message.trim(),
          sender_type: "contact",
        });

      if (error) throw error;

      setMessage("");
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-accent/20">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/public-chat")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">
              {conversation.department_data?.name || "Chat ao Vivo"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Você está conversando com nossa equipe
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages && messages.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma mensagem ainda. Envie sua primeira mensagem!
                </p>
              </CardContent>
            </Card>
          )}

          {messages?.map((msg) => {
            const isCustomer = msg.sender_type === "contact";
            return (
              <div
                key={msg.id}
                className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
              >
                <Card
                  className={`max-w-[80%] ${
                    isCustomer
                      ? "bg-primary text-primary-foreground"
                      : "bg-card"
                  }`}
                >
                  <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isCustomer
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="bg-card border-t border-border p-4">
        <div className="max-w-4xl mx-auto">
          {/* FASE 4: AI Typing Indicator */}
          {isAITyping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
              </div>
              <span>Assistente Virtual está digitando...</span>
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || isSending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
