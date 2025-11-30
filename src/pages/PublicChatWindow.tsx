import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessagesOffline, usePendingMessages } from "@/hooks/useMessagesOffline";
import { useSendMessageOffline } from "@/hooks/useSendMessageOffline";
import { useToast } from "@/hooks/use-toast";
import { Send, ArrowLeft, MessageSquare, Bot, Clock, Check, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAutopilotTrigger } from "@/hooks/useAutopilotTrigger";
import { cn } from "@/lib/utils";
import { SafeHTML } from "@/components/SafeHTML";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { createPublicChatClient, clearSessionToken } from "@/lib/publicSupabaseClient";
import { RatingWidget } from "@/components/public/RatingWidget";

export default function PublicChatWindow() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [isAITyping, setIsAITyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SECURITY: Use custom Supabase client with session token
  const supabase = createPublicChatClient();

  const { messages = [], isOffline } = useMessagesOffline(conversationId || null);
  const pendingMessages = usePendingMessages(conversationId || null);
  const sendMessageMutation = useSendMessageOffline();
  
  useAutopilotTrigger(conversationId || null);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
      // Salvar conversationId no localStorage para persistir sessão
      localStorage.setItem('active_conversation_id', conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timeout de segurança para isAITyping (15 segundos)
  useEffect(() => {
    if (isAITyping) {
      // Limpar timeout anterior se existir
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Criar novo timeout de 15 segundos
      typingTimeoutRef.current = setTimeout(() => {
        console.warn('[PublicChatWindow] Typing timeout - forçando isAITyping = false');
        setIsAITyping(false);
      }, 15000);
      
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }
  }, [isAITyping]);

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
          
          if (newMsg.sender_type === 'contact') {
            setIsAITyping(true);
          }
          
          if (newMsg.sender_type === 'user' || newMsg.is_ai_generated) {
            setIsAITyping(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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
      console.error('[PublicChatWindow] Error loading conversation:', error);
      
      // SECURITY: Clear session if token is invalid (403/401 errors)
      if (error.code === 'PGRST301' || error.message?.includes('permission')) {
        console.warn('[PublicChatWindow] Invalid session token - clearing');
        clearSessionToken();
      }
      
      // ✅ FIX: Limpar localStorage para evitar loop infinito
      localStorage.removeItem('active_conversation_id');
      
      toast({
        title: "Conversa não encontrada",
        description: "Iniciando nova conversa...",
        variant: "destructive",
      });
      navigate("/public-chat");
      return;
    }

    setConversation(data);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !conversationId || sendMessageMutation.isPending) return;

    const messageContent = message.trim();
    setMessage("");
    
    await sendMessageMutation.mutateAsync({
      conversationId,
      content: messageContent
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/public-chat')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{conversation.department_data?.name || 'Chat'}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            {isOffline ? (
              <>
                <WifiOff className="h-3 w-3" />
                Modo Offline
              </>
            ) : (
              'Online'
            )}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6">
          <div className="max-w-3xl mx-auto w-full">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-slate-500 dark:text-slate-400">Nenhuma mensagem ainda. Comece a conversar!</div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* CSAT Widget - Mostrar quando conversa for fechada */}
                {conversation.status === 'closed' && (
                  <RatingWidget 
                    conversationId={conversation.id} 
                    channel={conversation.channel} 
                  />
                )}
                
                {messages.map((message) => {
                  const isCustomer = message.sender_type === 'contact';
                  const isSystem = message.sender_type === 'system';
                  const isAI = message.is_ai_generated;

                  if (isSystem) {
                    return (
                      <div key={message.id} className="flex justify-center py-3">
                        <div className="bg-slate-200/50 dark:bg-slate-800/50 px-4 py-2 rounded-full">
                          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                            📢 {message.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-2",
                        isCustomer ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isCustomer && (
                        <div className="w-9 h-9 shrink-0 shadow-sm">
                          {isAI ? (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                              <Bot className="h-5 w-5 text-white" />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                              {message.sender?.full_name
                                ?.split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .slice(0, 2) || "?"}
                            </div>
                          )}
                        </div>
                      )}
                      
                          <div className={cn("flex flex-col", isCustomer ? "items-start" : "items-end")}>
                            {!isCustomer && (
                              <p className="text-xs text-muted-foreground mb-1 px-1 font-medium">
                                {isAI ? "Assistente Virtual" : message.sender?.full_name}
                                {message.sender?.job_title && (
                                  <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                    {message.sender.job_title}
                                  </span>
                                )}
                              </p>
                            )}
                            
                            <div
                              className={cn(
                                "max-w-[75%] px-4 py-3 shadow-sm",
                                isCustomer
                                  ? "bg-blue-600 dark:bg-blue-700 text-white rounded-2xl rounded-tr-none"
                                  : isAI
                                  ? "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-tl-none text-slate-800 dark:text-slate-100"
                                  : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-tl-none text-slate-800 dark:text-slate-100"
                              )}
                            >
                              <SafeHTML 
                                html={message.content}
                                className="text-sm whitespace-pre-wrap break-words"
                              />
                              <div className={cn(
                                "text-[10px] mt-1 flex items-center gap-1",
                                isCustomer ? "text-white/70" : "text-slate-400 dark:text-slate-500"
                              )}>
                                <span>
                                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                                {isCustomer && message.id.startsWith('temp-') && (
                                  <Clock className="h-3 w-3 animate-pulse" />
                                )}
                                {isCustomer && !message.id.startsWith('temp-') && (
                                  <Check className="h-3 w-3" />
                                )}
                              </div>
                            </div>
                          </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {isAITyping && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <Bot className="h-4 w-4 text-slate-500 dark:text-slate-400 animate-pulse" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Assistente Virtual está digitando...</span>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-center">
          <Input
            placeholder="Digite sua mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 rounded-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-5 py-3 h-12"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={sendMessageMutation.isPending || !message.trim()}
            size="icon"
            className="rounded-full h-12 w-12 shrink-0 shadow-md"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      <PWAInstallPrompt />
    </div>
  );
}
