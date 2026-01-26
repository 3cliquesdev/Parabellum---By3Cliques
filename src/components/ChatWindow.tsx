import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, MessageCircle, ArrowRightLeft, FileText, Hand, Bot, MessageSquare, CheckCircle, AlertCircle, DollarSign, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
import { useSendEmail } from "@/hooks/useSendEmail";
import { useAuth } from "@/hooks/useAuth";
import { useAIMode } from "@/hooks/useAIMode";
import { useActivePersona } from "@/hooks/useActivePersona";
import { useTakeControl } from "@/hooks/useTakeControl";
import { useReturnToAutopilot } from "@/hooks/useReturnToAutopilot";
import { useAutopilotTrigger } from "@/hooks/useAutopilotTrigger";
import TransferConversationDialog from "@/components/TransferConversationDialog";
import { CreateTicketFromInboxDialog } from "@/components/CreateTicketFromInboxDialog";
import CopilotSuggestionCard from "@/components/CopilotSuggestionCard";
import CloseConversationDialog from "@/components/CloseConversationDialog";
import DealDialog from "@/components/DealDialog";
import { ChannelIcon } from "@/components/ChannelIcon";
import { InternalNoteMessage } from "@/components/InternalNoteMessage";
import { ConversationTagsSection } from "@/components/inbox/ConversationTagsSection";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { SuperComposer } from "@/components/inbox/SuperComposer";
import { MessageSkeleton } from "@/components/inbox/MessageSkeleton";
import { MessagesWithMedia } from "@/components/inbox/MessagesWithMedia";
import { useCustomerTags } from "@/hooks/useCustomerTags";
import { useMarkAsRead } from "@/hooks/useUnreadCount";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useRolePermissions } from "@/hooks/useRolePermissions";
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
  const [confirmTakeControlOpen, setConfirmTakeControlOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { isAdmin, isManager, isSalesRep } = useUserRole();
  const { hasPermission } = useRolePermissions();
  const { data: messages = [], isLoading: isMessagesLoading } = useMessages(conversation?.id || null);
  const { data: aiMode, isLoading: aiModeLoading } = useAIMode(conversation?.id || null);
  const { data: activePersona } = useActivePersona(conversation?.id || null);
  const sendMessage = useSendMessage();
  const sendEmail = useSendEmail();
  const takeControl = useTakeControl();
  const returnToAutopilot = useReturnToAutopilot();
  
  // Buscar ticket relacionado para mostrar ticket_number
  const { data: relatedTicket } = useQuery({
    queryKey: ['related-ticket', conversation?.related_ticket_id],
    queryFn: async () => {
      if (!conversation?.related_ticket_id) return null;
      const { data } = await supabase
        .from('tickets')
        .select('ticket_number, status')
        .eq('id', conversation.related_ticket_id)
        .single();
      return data;
    },
    enabled: !!conversation?.related_ticket_id,
  });
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
          
          const finalMessage = messageContent;
          
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
          <DealDialog
            open={createDealDialogOpen}
            onOpenChange={setCreateDealDialogOpen}
            prefilledContactId={conversation.contacts?.id}
          />
        </>
      )}
      
      {conversation ? (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50/50 dark:bg-background">
          {/* Header compacto em 2 linhas */}
          <div className="flex-none border-b border-slate-200 dark:border-zinc-800 px-4 py-2 !bg-white dark:!bg-zinc-900/95 backdrop-blur">
            {/* Linha 1: Avatar + Info + Badges */}
            <div className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Avatar com ícone de canal */}
                <div className="relative shrink-0">
                  <Avatar className="w-9 h-9">
                    {contact?.avatar_url ? (
                      <AvatarImage src={contact.avatar_url} alt={`${contact.first_name} ${contact.last_name}`} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                      {contact?.first_name?.[0] || ''}{contact?.last_name?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <ChannelIcon channel={conversation.channel} size="sm" />
                  </div>
                </div>

                {/* Info principal - horizontal */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 dark:text-zinc-100 truncate">
                      {contact?.first_name} {contact?.last_name}
                    </p>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 truncate hidden sm:inline">
                      {contact?.email || contact?.phone}
                    </span>
                    {conversation.related_ticket_id && relatedTicket && (
                      <Badge 
                        variant={relatedTicket.status === 'closed' || relatedTicket.status === 'resolved' ? 'secondary' : 'outline'} 
                        className="text-[10px] px-1.5 py-0 h-5 gap-1 shrink-0"
                      >
                        <Ticket className="h-3 w-3" />
                        #{relatedTicket.ticket_number || conversation.related_ticket_id.slice(0, 8)}
                      </Badge>
                    )}
                    {!aiModeLoading && (
                      <Badge 
                        variant={isAutopilot ? "default" : isCopilot ? "info" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-5 shrink-0"
                      >
                        {isAutopilot && "🤖 Autopilot"}
                        {isCopilot && "🧠 Copilot"}
                        {isDisabled && "👤 Manual"}
                      </Badge>
                    )}
                    {!((conversation.customer_metadata as any)?.session_verified ?? true) && (
                      <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Não verificado
                      </Badge>
                    )}
                  </div>
                  
                  {/* Tags em linha única */}
                  <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-none">
                    {customerTags.slice(0, 3).map((ct: any) => (
                      <Badge 
                        key={ct.id} 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 h-4 shrink-0"
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
                      <span className="text-[10px] text-muted-foreground shrink-0">+{customerTags.length - 3}</span>
                    )}
                    <ConversationTagsSection conversationId={conversation.id} />
                  </div>
                </div>
              </div>

              {/* Botões de ação - lado direito */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isAutopilot && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setConfirmTakeControlOpen(true)}
                    disabled={takeControl.isPending}
                    className="h-7 gap-1 px-2"
                  >
                    <Hand className="h-3.5 w-3.5" />
                    <span className="text-xs hidden lg:inline">Assumir</span>
                  </Button>
                )}

                {(isCopilot || aiMode === 'waiting_human') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReturnToAutopilot}
                    disabled={returnToAutopilot.isPending}
                    className="h-7 gap-1 px-2"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span className="text-xs hidden lg:inline">IA</span>
                  </Button>
                )}

                {(isSalesRep || isAdmin || isManager) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateDealDialogOpen(true)}
                    className="h-7 gap-1 px-2"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="text-xs hidden xl:inline">Negócio</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateTicketDialogOpen(true)}
                  className="h-7 gap-1 px-2"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="text-xs hidden xl:inline">Ticket</span>
                </Button>
                
                {hasPermission('inbox.transfer') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransferDialogOpen(true)}
                    className="h-7 gap-1 px-2"
                    disabled={conversation.status === "closed"}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    <span className="text-xs hidden xl:inline">Transferir</span>
                  </Button>
                )}
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setCloseDialogOpen(true)}
                  className="h-7 gap-1 px-2 bg-green-600 hover:bg-green-700"
                  disabled={conversation.status === "closed"}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="text-xs hidden xl:inline">Encerrar</span>
                </Button>
                
                {!isAutopilot && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEmailMode(!isEmailMode)}
                    title={isEmailMode ? "Chat" : "Email"}
                    className="h-7 w-7"
                  >
                    {isEmailMode ? <MessageCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
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
                  <MessageSkeleton count={6} />
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-slate-500 dark:text-zinc-400">Nenhuma mensagem ainda</div>
                  </div>
                ) : (
                <MessagesWithMedia 
                    messages={messages}
                    contact={contact}
                    conversation={conversation}
                    isAdmin={isAdmin}
                    isManager={isManager}
                    messagesEndRef={messagesEndRef}
                  />
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
                <SuperComposer
                  conversationId={conversation.id}
                  isDisabled={conversation.status === "closed"}
                  whatsappInstanceId={conversation.whatsapp_instance_id}
                  whatsappMetaInstanceId={conversation.whatsapp_meta_instance_id}
                  whatsappProvider={conversation.whatsapp_provider}
                  contactPhone={contact?.phone || contact?.whatsapp_id}
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

      {/* Diálogo de confirmação para assumir conversa */}
      <AlertDialog open={confirmTakeControlOpen} onOpenChange={setConfirmTakeControlOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assumir esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será responsável por esta conversa. Ela ficará atribuída a você 
              e sairá da fila do departamento. Outros agentes não verão mais esta conversa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTakeControl}>
              Sim, assumir conversa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
