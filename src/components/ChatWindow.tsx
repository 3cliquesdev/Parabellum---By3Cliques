import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Mail, MessageCircle, ArrowRightLeft, FileText, Hand, Bot, MessageSquare, CheckCircle, AlertCircle, DollarSign, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
import { useSendEmail } from "@/hooks/useSendEmail";
import { useAuth } from "@/hooks/useAuth";
import { useAIMode } from "@/hooks/useAIMode";
import { useActivePersona } from "@/hooks/useActivePersona";
import { useTakeControl } from "@/hooks/useTakeControl";
import { useReturnToAutopilot } from "@/hooks/useReturnToAutopilot";
import { useAutopilotTrigger } from "@/hooks/useAutopilotTrigger";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import TransferConversationDialog from "@/components/TransferConversationDialog";
import { CreateTicketFromInboxDialog } from "@/components/CreateTicketFromInboxDialog";
import CopilotSuggestionCard from "@/components/CopilotSuggestionCard";
import CloseConversationDialog from "@/components/CloseConversationDialog";
import DealDialog from "@/components/DealDialog";
import { SafeHTML } from "@/components/SafeHTML";
import { MessageStatusIndicator } from "@/components/MessageStatusIndicator";
import { AIDebugTooltip } from "@/components/AIDebugTooltip";
import { ChannelIcon } from "@/components/ChannelIcon";
import { ChatComposer } from "@/components/ChatComposer";
import { InternalNoteMessage } from "@/components/InternalNoteMessage";
import { useCustomerTags } from "@/hooks/useCustomerTags";
import { useMarkAsRead } from "@/hooks/useUnreadCount";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
  } | null;
};

interface ChatWindowProps {
  conversation: Conversation | null;
}

export default function ChatWindow({ conversation }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [createTicketDialogOpen, setCreateTicketDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [createDealDialogOpen, setCreateDealDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { isAdmin, isManager, isSalesRep } = useUserRole();
  const { data: messages = [], isLoading: isMessagesLoading } = useMessages(conversation?.id || null);
  const { data: aiMode, isLoading: aiModeLoading } = useAIMode(conversation?.id || null);
  const { data: activePersona } = useActivePersona(conversation?.id || null);
  const sendMessage = useSendMessage();
  const sendEmail = useSendEmail();
  const takeControl = useTakeControl();
  const returnToAutopilot = useReturnToAutopilot();
  
  // FASE 6: Tags do contato
  const { data: customerTags = [] } = useCustomerTags(conversation?.contacts?.id || null);
  
  // FASE 4: Marcar como lido ao selecionar conversa
  const { markAsRead } = useMarkAsRead();
  
  // Ativa Autopilot trigger para responder automaticamente
  useAutopilotTrigger(conversation?.id || null);

  const contact = conversation?.contacts;
  
  // Marcar mensagens como lidas quando a conversa é selecionada
  useEffect(() => {
    if (conversation?.id) {
      markAsRead(conversation.id);
    }
  }, [conversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // FASE 5 & 7: handleSendMessage com suporte a notas internas
  const handleSendMessage = async (isInternal: boolean = false) => {
    if (!message.trim() || !conversation) return;

    if (isEmailMode) {
      if (!emailSubject.trim()) return;

      await sendEmail.mutateAsync({
        to: conversation.contacts.email || '',
        to_name: `${conversation.contacts.first_name} ${conversation.contacts.last_name}`,
        subject: emailSubject.trim(),
        html: `<p>${message.trim().replace(/\n/g, '<br>')}</p>`,
        customer_id: conversation.contacts.id,
      });

      setMessage("");
      setEmailSubject("");
    } else {
      const isWhatsApp = conversation.channel === 'whatsapp';
      const messageContent = message.trim();
      
      // FASE 7: Se é nota interna, salvar apenas no banco (não enviar para cliente)
      if (isInternal) {
        await sendMessage.mutateAsync({
          conversation_id: conversation.id,
          content: messageContent,
          sender_type: "user",
          sender_id: user?.id || null,
          status: 'sent',
          is_internal: true,
        });
        setMessage("");
        return;
      }
      
      // CRITICAL: Send to WhatsApp API FIRST, only save to DB if successful
      if (isWhatsApp && conversation.whatsapp_instance_id) {
        try {
          // Buscar instância para verificar dono
          const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('user_id')
            .eq('id', conversation.whatsapp_instance_id)
            .single();
          
          let finalMessage = messageContent;
          
          // Se quem envia não é o dono, adicionar assinatura
          if (instance?.user_id && instance.user_id !== user?.id) {
            const userName = user?.user_metadata?.full_name || 'Agente';
            finalMessage += `\n\n*^${userName}*`;
          }
          
          // 1. FIRST: Send to Evolution API
          const { data: evolutionResponse, error: evolutionError } = await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              instance_id: conversation.whatsapp_instance_id,
              phone_number: conversation.contacts.phone || conversation.contacts.whatsapp_id,
              message: finalMessage,
              delay: 1000,
            }
          });

          if (evolutionError) {
            throw new Error(evolutionError.message || 'Failed to send WhatsApp message');
          }

          // 2. ONLY IF SUCCESS: Save to database with status='sent'
          await sendMessage.mutateAsync({
            conversation_id: conversation.id,
            content: messageContent,
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'sent',
          });

        } catch (error) {
          console.error('[ChatWindow] WhatsApp send failed:', error);
          
          // Save to database with status='failed' for visibility
          await sendMessage.mutateAsync({
            conversation_id: conversation.id,
            content: messageContent,
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'failed',
            delivery_error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          // Don't throw - message is saved with failed status for retry
        }
      } else {
        // Web chat - save directly (no external API)
        await sendMessage.mutateAsync({
          conversation_id: conversation.id,
          content: messageContent,
          sender_type: "user",
          sender_id: user?.id || null,
          status: 'sent',
        });
      }

      setMessage("");
    }
  };

  const handleTakeControl = () => {
    if (!conversation) return;
    takeControl.mutate({
      conversationId: conversation.id,
      contactId: conversation.contacts.id
    });
  };

  const handleReturnToAutopilot = () => {
    if (!conversation) return;
    returnToAutopilot.mutate({
      conversationId: conversation.id,
      contactId: conversation.contacts.id
    });
  };

  const handleUseSuggestion = (text: string) => {
    setMessage(text);
  };

  const isAutopilot = aiMode === 'autopilot';
  const isCopilot = aiMode === 'copilot';
  const isDisabled = aiMode === 'disabled';

  const isSending = sendMessage.isPending || sendEmail.isPending;

  return (
    <>
      {conversation && (
        <>
          <TransferConversationDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            conversation={conversation}
            currentUserId={user?.id || ""}
          />
          <CreateTicketFromInboxDialog
            open={createTicketDialogOpen}
            onOpenChange={setCreateTicketDialogOpen}
            conversationId={conversation.id}
            contactName={`${conversation.contacts?.first_name || ''} ${conversation.contacts?.last_name || ''}`}
          />
          <CloseConversationDialog
            open={closeDialogOpen}
            onOpenChange={setCloseDialogOpen}
            conversation={conversation}
            userId={user?.id || ""}
          />
          {createDealDialogOpen && (
            <DealDialog
              prefilledContactId={conversation.contacts?.id}
              trigger={<></>}
              onOpenChange={(open) => setCreateDealDialogOpen(open)}
            />
          )}
        </>
      )}
      
      {conversation ? (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/50 dark:bg-background">
          <div className="flex-none border-b border-slate-200 dark:border-zinc-800 px-4 py-3 !bg-white dark:!bg-zinc-900/95 backdrop-blur flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar com ícone de canal */}
              <div className="relative shrink-0">
                <Avatar className="w-10 h-10">
                  {contact?.avatar_url ? (
                    <AvatarImage src={contact.avatar_url} alt={`${contact.first_name} ${contact.last_name}`} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                    {contact?.first_name?.[0] || ''}{contact?.last_name?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                {/* FASE 2: Ícone de canal colorido */}
                <div className="absolute -bottom-0.5 -right-0.5">
                  <ChannelIcon channel={conversation.channel} size="sm" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 dark:text-zinc-100">
                    {contact?.first_name} {contact?.last_name}
                  </p>
                  {/* FASE 6: Badge de Ticket vinculado */}
                  {conversation.related_ticket_id && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                      <Ticket className="h-3 w-3" />
                      #{conversation.related_ticket_id.slice(0, 8)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {contact?.email || contact?.phone}
                </p>
                {/* FASE 6: Tags do contato */}
                {customerTags.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {customerTags.slice(0, 3).map((ct: any) => (
                      <Badge 
                        key={ct.id} 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 h-4"
                        style={{
                          borderColor: ct.tags?.color || undefined,
                          color: ct.tags?.color || undefined,
                          backgroundColor: ct.tags?.color ? `${ct.tags.color}15` : undefined,
                        }}
                      >
                        {ct.tags?.name}
                      </Badge>
                    ))}
                    {customerTags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{customerTags.length - 3}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {conversation.assigned_user && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      {conversation.assigned_user.full_name}
                    </Badge>
                  )}
                  {!aiModeLoading && (
                    <>
                      <Badge 
                        variant={isAutopilot ? "default" : isCopilot ? "info" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-5"
                      >
                        {isAutopilot && "🤖 Autopilot"}
                        {isCopilot && "🧠 Copilot"}
                        {isDisabled && "👤 Manual"}
                      </Badge>
                      {activePersona && isAutopilot && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                          {activePersona.name}
                        </Badge>
                  )}
                </>
              )}
              {/* Badge de Sessão Não Verificada */}
              {!((conversation.customer_metadata as any)?.session_verified ?? true) && (
                <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-5">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Não verificado
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
              {isAutopilot && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTakeControl}
                  disabled={takeControl.isPending}
                  className="h-8 gap-1"
                >
                  <Hand className="h-4 w-4" />
                  <span className="text-xs">Assumir Controle</span>
                </Button>
              )}

              {isCopilot && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReturnToAutopilot}
                  disabled={returnToAutopilot.isPending}
                  className="h-8 gap-1"
                >
                  <Bot className="h-4 w-4" />
                  <span className="text-xs">Devolver para IA</span>
                </Button>
              )}

              {(isSalesRep || isAdmin || isManager) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateDealDialogOpen(true)}
                  className="h-8 gap-1"
                >
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Negócio</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateTicketDialogOpen(true)}
                className="h-8 gap-1"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs">Ticket</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransferDialogOpen(true)}
                className="h-8 gap-1"
                disabled={conversation.status === "closed"}
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-xs">Transferir</span>
              </Button>
              
              <Button
                variant="default"
                size="sm"
                onClick={() => setCloseDialogOpen(true)}
                className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                disabled={conversation.status === "closed"}
              >
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs">Encerrar</span>
              </Button>
              
              {!isAutopilot && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEmailMode(!isEmailMode)}
                  title={isEmailMode ? "Chat" : "Email"}
                  className="h-8 w-8"
                >
                  {isEmailMode ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {isAutopilot && (
            <Alert className="m-4 mb-0 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/50">
              <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <AlertDescription className="text-violet-800 dark:text-violet-300">
                {activePersona ? `Persona "${activePersona.name}"` : 'IA'} está respondendo automaticamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100/50 dark:bg-background">
            <div className="p-4 md:p-6">
              <div className="max-w-3xl mx-auto w-full">
                {conversation.status === "closed" && (
                  <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-center">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                      ✅ Esta conversa foi encerrada
                    </p>
                  </div>
                )}
                
                {isMessagesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-slate-500 dark:text-zinc-400">Carregando mensagens...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-slate-500 dark:text-zinc-400">Nenhuma mensagem ainda</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isCustomer = message.sender_type === 'contact';
                      const isSystem = message.sender_type === 'system';
                      const isAI = message.is_ai_generated;
                      const isInternalNote = message.is_internal;
                      
                      // Parse AI debug metadata
                      let usedArticles: any[] = [];
                      try {
                        if (isAI && message.attachment_url) {
                          const metadata = JSON.parse(message.attachment_url);
                          usedArticles = metadata.used_articles || [];
                        }
                      } catch (e) {
                        // Ignore parse errors
                      }

                      // FASE 8: Renderizar notas internas com estilo especial
                      if (isInternalNote) {
                        return (
                          <InternalNoteMessage
                            key={message.id}
                            content={message.content}
                            createdAt={message.created_at}
                            senderName={message.sender?.full_name}
                          />
                        );
                      }

                      if (isSystem) {
                        return (
                          <div key={message.id} className="flex justify-center py-3">
                            <div className="bg-slate-200/50 dark:bg-zinc-800/50 px-4 py-2 rounded-full">
                              <p className="text-xs text-slate-600 dark:text-zinc-400 text-center">
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
                            isCustomer ? "justify-start" : "justify-end"
                          )}
                        >
                          {isCustomer && (
                            <Avatar className="w-9 h-9 shrink-0 shadow-sm">
                              <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-600 text-white text-sm font-semibold">
                                {contact?.first_name?.[0] || ''}{contact?.last_name?.[0] || ''}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          {!isCustomer && (
                            <Avatar className="w-9 h-9 shrink-0 shadow-sm order-2">
                              {isAI ? (
                                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600">
                                  <Bot className="h-5 w-5 text-white" />
                                </AvatarFallback>
                              ) : message.sender ? (
                                <>
                                  {message.sender.avatar_url ? (
                                    <AvatarImage src={message.sender.avatar_url} alt={message.sender.full_name} />
                                  ) : null}
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                                    {message.sender.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </>
                              ) : (
                                <AvatarFallback>?</AvatarFallback>
                              )}
                            </Avatar>
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
                                  ? "bg-slate-900 text-white rounded-2xl rounded-tl-none"
                                  : isAI
                                  ? "bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl rounded-tr-none text-violet-900 dark:text-violet-300"
                                  : "bg-blue-600 dark:bg-blue-600/90 text-white rounded-2xl rounded-tr-none"
                              )}
                             >
                              <SafeHTML 
                                html={message.content}
                                className="text-sm whitespace-pre-wrap break-words"
                              />
                              <div className={cn(
                                "text-[10px] mt-1 flex items-center gap-1.5",
                                isCustomer ? "text-slate-400 dark:text-zinc-500" : 
                                isAI ? "text-violet-600 dark:text-violet-400 opacity-70" : 
                                "text-white opacity-70"
                              )}>
                                <span>
                                  {format(new Date(message.created_at), "HH:mm")}
                                </span>
                                {/* AI Debug Icon for Admins/Managers */}
                                {isAI && (isAdmin || isManager) && (
                                  <AIDebugTooltip usedArticles={usedArticles} />
                                )}
                                {/* Status indicator for user/agent messages */}
                                {!isCustomer && (message as any).status && (
                                  <MessageStatusIndicator 
                                    status={(message as any).status}
                                    className={isAI ? "text-violet-600 dark:text-violet-400" : "text-white"}
                                  />
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
          </div>

          {isCopilot && conversation && (
            <div className="flex-none mx-4 mb-2">
              <CopilotSuggestionCard 
                conversationId={conversation.id}
                onUseSuggestion={handleUseSuggestion}
              />
            </div>
          )}

          {isAutopilot ? (
            <div className="flex-none p-4 border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
              <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                <Bot className="h-4 w-4" />
                <span>Modo Piloto Automático - Digite mensagens desabilitado</span>
              </div>
            </div>
          ) : (
            <>
              {isEmailMode ? (
                <div className="flex-none bg-white/95 dark:bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-800 p-4 space-y-2">
                  <div className="max-w-3xl mx-auto space-y-2">
                    <Input
                      placeholder="Assunto do e-mail"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                    />
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Digite sua mensagem de e-mail..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="flex-1 min-h-[80px] bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2">
                      <Button onClick={() => handleSendMessage(false)} disabled={isSending || !message.trim() || !emailSubject.trim()}>
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar E-mail
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <ChatComposer
                  message={message}
                  setMessage={setMessage}
                  onSendMessage={handleSendMessage}
                  isSending={isSending}
                  isDisabled={conversation.status === "closed"}
                  placeholder="Digite sua mensagem ou / para macros..."
                />
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-background">
          <div className="text-center text-slate-500 dark:text-zinc-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma conversa para começar</p>
          </div>
        </div>
      )}
    </>
  );
}
