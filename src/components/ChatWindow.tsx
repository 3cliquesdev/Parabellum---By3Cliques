import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, MessageCircle, ArrowRightLeft, FileText, Hand, Bot, MessageSquare, CheckCircle, AlertCircle, DollarSign, Ticket, PanelRightClose, PanelRight, FlaskConical, Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
import { useSendMessageInstant } from "@/hooks/useSendMessageInstant";
import { useSendEmail } from "@/hooks/useSendEmail";
import { useAuth } from "@/hooks/useAuth";
import { useAIMode } from "@/hooks/useAIMode";
import { useActivePersona } from "@/hooks/useActivePersona";
import { useTakeControl } from "@/hooks/useTakeControl";
import { useCanTakeControl } from "@/hooks/useCanTakeControl";
import { useReturnToAutopilot } from "@/hooks/useReturnToAutopilot";
import { useAutopilotTrigger } from "@/hooks/useAutopilotTrigger";
import { useTestModeToggle } from "@/hooks/useTestModeToggle";
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
import { ReengageTemplateDialog } from "@/components/inbox/ReengageTemplateDialog";
import { MessageSkeleton } from "@/components/inbox/MessageSkeleton";
import { MessagesWithMedia } from "@/components/inbox/MessagesWithMedia";
import { ActiveFlowIndicator } from "@/components/inbox/ActiveFlowIndicator";
import { TestModeDropdown } from "@/components/inbox/TestModeDropdown";
import { FlowPickerButton } from "@/components/inbox/FlowPickerButton";
import { useActiveFlowState } from "@/hooks/useActiveFlowState";
// REMOVIDO: useCustomerTags - tags do contato não devem aparecer no header do chat
// Tags da conversa são gerenciadas por ConversationTagsSection
import { useMarkAsRead } from "@/hooks/useUnreadCount";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { hasFullAccess } from "@/config/roles";
import { useAIGlobalConfig } from "@/hooks/useAIGlobalConfig";
import { useToast } from "@/hooks/use-toast";
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
  isContactPanelOpen?: boolean;
  onToggleContactPanel?: () => void;
  onConversationUpdated?: (conversation: Conversation) => void;
}

export default function ChatWindow({ conversation, isContactPanelOpen = true, onToggleContactPanel, onConversationUpdated }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [createTicketDialogOpen, setCreateTicketDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [createDealDialogOpen, setCreateDealDialogOpen] = useState(false);
  const [reengageDialogOpen, setReengageDialogOpen] = useState(false);
  // Captura os IDs antes de abrir o diálogo de confirmação (fix: conversation pode mudar para null)
  const [pendingTakeControl, setPendingTakeControl] = useState<{ conversationId: string; contactId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // UX: Typing indicator + new message badge + relative timestamps
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasNewMessageBelow, setHasNewMessageBelow] = useState(false);
  const [tickCounter, setTickCounter] = useState(0);
  const { user } = useAuth();
  const { isAdmin, isManager, isSalesRep, role } = useUserRole();
  const { hasPermission } = useRolePermissions();
  const { data: messages = [], isLoading: isMessagesLoading, fetchOlderMessages, hasMoreOlder, isFetchingOlder } = useMessages(conversation?.id || null);
  const { data: aiMode, isLoading: aiModeLoading } = useAIMode(conversation?.id || null);
  const { data: activePersona } = useActivePersona(conversation?.id || null);
  const sendMessage = useSendMessage();
  const { sendInstant } = useSendMessageInstant();
  const sendEmail = useSendEmail();
  const takeControl = useTakeControl();
  const returnToAutopilot = useReturnToAutopilot();
  const { isAIEnabled: isAIGlobalEnabled } = useAIGlobalConfig();
  const { isTestMode, toggle: toggleTestMode, isPending: isTestModePending } = useTestModeToggle(conversation?.id || null);
  const { activeFlow } = useActiveFlowState(conversation?.id || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Verificar se pode assumir esta conversa
  // Regra: qualquer usuário pode assumir conversas “disponíveis” vindas da IA (não atribuídas)
  const { canTake: canTakeControl, reason: cantTakeReason } = useCanTakeControl({
    departmentId: conversation?.department || null,
    assignedTo: conversation?.assigned_to || null,
    // Fallback: useAIMode pode atrasar; usar valor do registro evita botão ficar travado/desabilitado
    aiMode: ((aiMode as any) || (conversation?.ai_mode as any)) || null,
    status: (conversation?.status as any) || null,
  });
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
  // REMOVIDO: Tags do contato não devem aparecer no header do chat
  // Cada conversa começa "limpa" - tags são por conversa, não por contato
  
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

  // ========== TICK COUNTER for relative timestamps (every 60s) ==========
  useEffect(() => {
    const interval = setInterval(() => setTickCounter(c => c + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // ========== TYPING INDICATOR: clear when new message arrives ==========
  const prevMsgCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && (lastMsg.sender_type !== 'user' || lastMsg.sender_id !== user?.id)) {
        setIsWaitingResponse(false);
        if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]);

  // Reset waiting state on conversation change
  useEffect(() => {
    setIsWaitingResponse(false);
    setHasNewMessageBelow(false);
    if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
  }, [conversation?.id]);

  // ========== SMART SCROLL (WhatsApp-like) ==========
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldStickToBottom, setShouldStickToBottom] = useState(true);

  // Detectar se usuário scrollou para cima
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
      setShouldStickToBottom(distance < 140);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll apenas se estiver "grudado" no final
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !shouldStickToBottom) return;
    el.scrollTop = el.scrollHeight; // instant (WhatsApp-like)
  }, [messages?.length, shouldStickToBottom]);

  // UX: Show "new message" badge when scrolled up + clear when at bottom
  useEffect(() => {
    if (messages.length > prevMsgCount.current && !shouldStickToBottom) {
      setHasNewMessageBelow(true);
    }
  }, [messages.length, shouldStickToBottom]);

  useEffect(() => {
    if (shouldStickToBottom) setHasNewMessageBelow(false);
  }, [shouldStickToBottom]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setHasNewMessageBelow(false);
  }, []);

  // 🆕 ENTERPRISE: Scroll-up pagination (load older messages)
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<{ height: number; top: number } | null>(null);
  
  const handleLoadOlder = useCallback(async () => {
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollAnchorRef.current = {
        height: scrollEl.scrollHeight,
        top: scrollEl.scrollTop,
      };
    }
    await fetchOlderMessages();
  }, [fetchOlderMessages]);
  
  // Restore scroll position after older messages load
  useEffect(() => {
    const anchor = scrollAnchorRef.current;
    const scrollEl = scrollRef.current;
    if (anchor && scrollEl && !isFetchingOlder) {
      const heightDiff = scrollEl.scrollHeight - anchor.height;
      if (heightDiff > 0) {
        scrollEl.scrollTop = anchor.top + heightDiff;
      }
      scrollAnchorRef.current = null;
    }
  });
  
  // IntersectionObserver for auto-loading older messages on scroll up
  useEffect(() => {
    const el = loadMoreRef.current;
    const scrollEl = scrollRef.current;
    if (!el || !scrollEl || !hasMoreOlder) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleLoadOlder();
        }
      },
      { root: scrollEl, rootMargin: '200px' }
    );
    
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreOlder, handleLoadOlder]);

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
        // Web chat - INSTANT send (fire-and-forget)
        // Mensagem aparece IMEDIATAMENTE (<50ms) - não bloqueia UI
        sendInstant({
          conversationId: conversation.id,
          content: messageContent,
          isInternal: false,
          channel: 'web_chat',
        });
        // Input limpa instantaneamente - não aguarda persistência
        setMessage("");
        return; // Exit early - sendInstant já atualizou o cache
      }

      setMessage("");
    }
    
    // UX: Show typing indicator after sending (not for internal notes or emails)
    if (!isInternal && !isEmailMode) {
      setIsWaitingResponse(true);
      if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = setTimeout(() => setIsWaitingResponse(false), 60_000);
    }
  };

  // Abre o diálogo de confirmação capturando os IDs imediatamente
  const openTakeControlDialog = () => {
    // Proteção dupla: verificar conversation E contacts antes de acessar
    if (!conversation?.contacts?.id) {
      console.warn('[ChatWindow] openTakeControlDialog: conversation ou contacts é null, ignorando clique');
      toast({
        title: "Aguarde",
        description: "Carregando dados da conversa. Tente novamente em alguns segundos.",
        variant: "default",
      });
      return;
    }
    setPendingTakeControl({
      conversationId: conversation.id,
      contactId: conversation.contacts.id
    });
  };

  // Executa a mutation com os IDs capturados (fix: conversation pode ter mudado para null)
  // 🚀 UPGRADE: Navegar para "Minhas" após assumir para mostrar o composer instantaneamente
  const handleTakeControl = () => {
    if (!pendingTakeControl) return;
    const conversationToUpdate = conversation; // Capturar antes da mutation
    takeControl.mutate({
      ...pendingTakeControl,
      onSuccessCallback: () => {
        // Navegar para "Minhas" para que a conversa apareça com o composer
        setSearchParams(prev => {
          prev.set('filter', 'mine');
          return prev;
        });
        // Re-selecionar a conversa atualizada para manter o foco
        if (conversationToUpdate && onConversationUpdated) {
          onConversationUpdated({
            ...conversationToUpdate,
            ai_mode: 'copilot',
            assigned_to: user?.id || null
          });
        }
      }
    });
    setPendingTakeControl(null);
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

  const handleReopenConversation = async () => {
    if (!conversation) return;
    const { error } = await supabase
      .from("conversations")
      .update({ status: "open", closed_at: null })
      .eq("id", conversation.id);
    if (error) {
      console.error('[ChatWindow] Erro ao reabrir conversa:', error);
      toast({
        title: "Erro ao reabrir conversa",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    toast({ title: "Conversa reaberta" });
  };

  const effectiveAIMode = (aiMode as any) ?? (conversation?.ai_mode as any);
  const isAutopilot = effectiveAIMode === 'autopilot';
  const isCopilot = effectiveAIMode === 'copilot';
  const isDisabled = effectiveAIMode === 'disabled';
  const isWaitingHuman = effectiveAIMode === 'waiting_human';
  
  // IA Global desligada = IA não está ativa mesmo em autopilot
  const isAIActuallyActive = isAutopilot && isAIGlobalEnabled;
  
  // Mostrar botão "Assumir" quando:
  // 1. IA está controlando (autopilot) - mas avisar se global está off
  // 2. Conversa está aguardando humano (waiting_human)
  // 3. Conversa não está atribuída a ninguém (pool geral)
  const canShowTakeControl = isAutopilot || isWaitingHuman || !conversation?.assigned_to;

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
                    <Badge 
                      variant="outline" 
                      className="text-[10px] px-1.5 py-0 h-5 font-mono cursor-pointer shrink-0 select-all"
                      title="Clique para copiar protocolo"
                      onClick={() => {
                        const protocolId = `#${conversation.id.slice(0, 8).toUpperCase()}`;
                        navigator.clipboard.writeText(protocolId);
                        toast({ title: "Protocolo copiado!", description: protocolId });
                      }}
                    >
                      #{conversation.id.slice(0, 8).toUpperCase()}
                    </Badge>
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
                        {isAutopilot && "Autopilot"}
                        {isCopilot && "Copilot"}
                        {isDisabled && "Manual"}
                      </Badge>
                    )}
                    {!((conversation.customer_metadata as any)?.session_verified ?? true) && (
                      <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Não verificado
                      </Badge>
                    )}
                  </div>
                  
                  {/* Tags da conversa - cada conversa começa limpa */}
                  <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-none">
                    <ConversationTagsSection conversationId={conversation.id} contactId={conversation.contacts?.id} />
                  </div>
                </div>
              </div>

              {/* Botões de ação - lado direito */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 🧪 Dropdown de Modo de Teste + Seletor de Fluxos (unificado) */}
                {hasPermission('inbox.test_mode') && hasFullAccess(role) && (
                  <TestModeDropdown
                    isTestMode={isTestMode}
                    toggleTestMode={toggleTestMode}
                    isTestModePending={isTestModePending}
                    conversationId={conversation.id}
                    contactId={conversation.contact_id}
                  />
                )}

                {/* FlowPickerButton só aparece fora do modo teste */}
                {!isTestMode && (
                  <FlowPickerButton
                    conversationId={conversation.id}
                    contactId={conversation.contact_id}
                    isTestMode={isTestMode}
                    hasActiveFlow={!!activeFlow}
                  />
                )}

                {canShowTakeControl && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={openTakeControlDialog}
                    disabled={takeControl.isPending || !canTakeControl}
                    title={!canTakeControl ? cantTakeReason : undefined}
                    className="h-7 gap-1 px-2"
                  >
                    <Hand className="h-3.5 w-3.5" />
                    <span className="text-xs hidden lg:inline">Assumir</span>
                  </Button>
                )}

                {(isCopilot || isWaitingHuman) && (
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
                
                {!canShowTakeControl && (
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
                
                {/* Toggle Contact Panel */}
                {onToggleContactPanel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleContactPanel}
                    title={isContactPanelOpen ? "Ocultar painel do contato" : "Mostrar painel do contato"}
                    className="h-7 w-7"
                  >
                    {isContactPanelOpen ? (
                      <PanelRightClose className="h-3.5 w-3.5" />
                    ) : (
                      <PanelRight className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Active Flow Indicator - fixed in header */}
          <ActiveFlowIndicator conversationId={conversation.id} />

          {canShowTakeControl && (
            <Alert className={cn(
              "m-4 mb-0",
              isAutopilot && !isAIGlobalEnabled
                ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50"
                : "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/50"
            )}>
              <Bot className={cn(
                "h-4 w-4",
                isAutopilot && !isAIGlobalEnabled
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-violet-600 dark:text-violet-400"
              )} />
              <AlertDescription className={cn(
                isAutopilot && !isAIGlobalEnabled
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-violet-800 dark:text-violet-300"
              )}>
                {isAutopilot && !isAIGlobalEnabled
                  ? 'IA Global está DESLIGADA. Esta conversa está na fila IA mas não está sendo respondida. Clique em "Assumir" para atender.'
                  : isWaitingHuman
                    ? 'Aguardando atendimento humano. Clique em "Assumir" para atender.'
                    : !conversation?.assigned_to
                      ? 'Conversa no pool geral. Clique em "Assumir" para atender.'
                      : activePersona 
                        ? `Persona "${activePersona.name}" está respondendo automaticamente.` 
                        : 'IA está respondendo automaticamente.'}
              </AlertDescription>
            </Alert>
          )}

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-[hsl(var(--chat-bg))]">
            <div className="px-4 py-6 md:px-6">
              <div className="max-w-4xl mx-auto w-full">
                {conversation.status === "closed" && (
                  <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-center">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                      Esta conversa foi encerrada
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
                  <>
                    {/* 🆕 ENTERPRISE: Sentinel for scroll-up pagination */}
                    {hasMoreOlder && (
                      <div ref={loadMoreRef} className="flex justify-center py-2">
                        {isFetchingOlder && <MessageSkeleton count={2} />}
                      </div>
                    )}
                    <MessagesWithMedia 
                      messages={messages}
                      contact={contact}
                      conversation={conversation}
                      isAdmin={isAdmin}
                      isManager={isManager}
                      messagesEndRef={messagesEndRef}
                      tickCounter={tickCounter}
                    />

                    {/* Typing indicator */}
                    {isWaitingResponse && (
                      <div className="flex justify-start gap-2 mt-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-1 px-4 py-3 bg-muted rounded-2xl rounded-tl-sm w-fit">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* "Nova mensagem ↓" floating badge */}
            {hasNewMessageBelow && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow-lg gap-1.5 rounded-full px-4 h-8 text-xs font-medium"
                  onClick={scrollToBottom}
                >
                  Nova mensagem
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {isCopilot && conversation && (
            <div className="flex-none mx-4 mb-2">
              <CopilotSuggestionCard 
                conversationId={conversation.id}
                onUseSuggestion={handleUseSuggestion}
              />
            </div>
          )}

          {conversation.status === "closed" && (
            <div className="flex-none p-3 border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <div className="max-w-3xl mx-auto flex items-center justify-center gap-3">
                <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  Esta conversa foi encerrada
                </span>
                {(conversation.channel === "whatsapp" || conversation.whatsapp_provider || conversation.whatsapp_meta_instance_id || conversation.whatsapp_instance_id) ? (
                  <Button size="sm" onClick={() => setReengageDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Reengajar via Template
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleReopenConversation}>
                    Reabrir Conversa
                  </Button>
                )}
              </div>
            </div>
          )}

          {canShowTakeControl ? (
            <div className="flex-none p-4 border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
              <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                <Bot className="h-4 w-4" />
                <span>
                  {isAutopilot && !isAIGlobalEnabled 
                    ? 'IA Global DESLIGADA - Conversa não atendida' 
                    : isWaitingHuman 
                      ? 'Aguardando atendimento humano'
                      : 'Modo Piloto Automático'} - Clique em "Assumir" para digitar
                </span>
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
                  aiMode={effectiveAIMode}
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
      <AlertDialog open={!!pendingTakeControl} onOpenChange={(open) => !open && setPendingTakeControl(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assumir esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será responsável por esta conversa. Ela ficará atribuída a você 
              e sairá da fila do departamento. Outros agentes não verão mais esta conversa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTakeControl(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTakeControl}>
              Sim, assumir conversa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reengage Template Dialog */}
      {conversation && (
        <ReengageTemplateDialog
          open={reengageDialogOpen}
          onOpenChange={setReengageDialogOpen}
          conversation={conversation}
        />
      )}
    </>
  );
}
