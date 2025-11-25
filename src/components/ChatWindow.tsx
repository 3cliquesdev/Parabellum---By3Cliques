import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Mail, MessageCircle, ArrowRightLeft, FileText, Hand, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
import { useSendEmail } from "@/hooks/useSendEmail";
import { useAuth } from "@/hooks/useAuth";
import { useAIMode } from "@/hooks/useAIMode";
import { useActivePersona } from "@/hooks/useActivePersona";
import { useTakeControl } from "@/hooks/useTakeControl";
import { useReturnToAutopilot } from "@/hooks/useReturnToAutopilot";
import TransferConversationDialog from "@/components/TransferConversationDialog";
import { CreateTicketFromInboxDialog } from "@/components/CreateTicketFromInboxDialog";
import CopilotSuggestionCard from "@/components/CopilotSuggestionCard";
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
  const [messageText, setMessageText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [createTicketDialogOpen, setCreateTicketDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { data: messages, isLoading } = useMessages(conversation?.id || null);
  const { data: aiMode, isLoading: aiModeLoading } = useAIMode(conversation?.id || null);
  const { data: activePersona } = useActivePersona(conversation?.id || null);
  const sendMessage = useSendMessage();
  const sendEmail = useSendEmail();
  const takeControl = useTakeControl();
  const returnToAutopilot = useReturnToAutopilot();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversation) return;

    if (isEmailMode) {
      // Modo Email
      if (!emailSubject.trim()) {
        return;
      }

      await sendEmail.mutateAsync({
        to: conversation.contacts.email || '',
        to_name: `${conversation.contacts.first_name} ${conversation.contacts.last_name}`,
        subject: emailSubject.trim(),
        html: `<p>${messageText.trim().replace(/\n/g, '<br>')}</p>`,
        customer_id: conversation.contacts.id,
      });

      setMessageText("");
      setEmailSubject("");
    } else {
      // Modo Chat
      await sendMessage.mutateAsync({
        conversation_id: conversation.id,
        content: messageText.trim(),
        sender_type: "user",
      });

      setMessageText("");
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
    setMessageText(text);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <p className="text-[#999999]">
          Selecione uma conversa para começar
        </p>
      </div>
    );
  }

  const isAutopilot = aiMode === 'autopilot';
  const isCopilot = aiMode === 'copilot';
  const isDisabled = aiMode === 'disabled';

  return (
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
        conversationId={conversation?.id || null}
        contactName={`${conversation?.contacts.first_name} ${conversation?.contacts.last_name}`}
      />
      <div className="flex-1 flex flex-col bg-black">
        {/* Header */}
        <div className="h-16 border-b border-border bg-card flex items-center px-4 gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {conversation.contacts.first_name[0]}
                {conversation.contacts.last_name[0]}
              </span>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">
                {conversation.contacts.first_name} {conversation.contacts.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {conversation.contacts.email || conversation.contacts.phone}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {conversation.assigned_user && (
                  <Badge variant="secondary" className="text-xs">
                    Atribuído: {conversation.assigned_user.full_name}
                  </Badge>
                )}
                {!aiModeLoading && (
                  <>
                    <Badge 
                      variant={isAutopilot ? "default" : isCopilot ? "outline" : "secondary"}
                      className="text-xs"
                    >
                      {isAutopilot && "🤖 Autopilot"}
                      {isCopilot && "🧠 Copilot"}
                      {isDisabled && "👤 Manual"}
                    </Badge>
                    {activePersona && isAutopilot && (
                      <Badge variant="secondary" className="text-xs">
                        AI: {activePersona.name}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Botão Assumir Controle (só em autopilot) */}
            {isAutopilot && (
              <Button
                variant="default"
                size="sm"
                onClick={handleTakeControl}
                disabled={takeControl.isPending}
                className="h-8 gap-1 bg-primary"
              >
                <Hand className="h-4 w-4" />
                <span className="text-xs">Assumir Controle</span>
              </Button>
            )}

            {/* Botão Devolver para Autopilot (só em copilot) */}
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

            {/* Generate Ticket Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateTicketDialogOpen(true)}
              className="h-8 gap-1 bg-primary/10 border-primary/20 hover:bg-primary/20"
            >
              <FileText className="h-4 w-4" />
              <span className="text-xs">Gerar Ticket</span>
            </Button>
            
            {/* Transfer Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferDialogOpen(true)}
              className="h-8 gap-1"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-xs">Transferir</span>
            </Button>
            
            {/* Toggle Email/Chat */}
            {!isAutopilot && (
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={!isEmailMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setIsEmailMode(false)}
                  className="h-8 gap-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs">Chat</span>
                </Button>
                <Button
                  variant={isEmailMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setIsEmailMode(true)}
                  className="h-8 gap-1"
                  disabled={!conversation.contacts.email}
                >
                  <Mail className="h-4 w-4" />
                  <span className="text-xs">Email</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Alerta de Autopilot */}
        {isAutopilot && (
          <Alert className="m-4 border-primary/50 bg-primary/5">
            <Bot className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              🤖 <strong>{activePersona ? `Persona "${activePersona.name}"` : 'IA'} está respondendo automaticamente</strong> nesta conversa. 
              {activePersona && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Papel: {activePersona.role}
                </span>
              )}
              Clique em "Assumir Controle" para entrar no modo Copilot e receber sugestões de resposta.
            </AlertDescription>
          </Alert>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : messages?.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages?.map((message) => {
                const isUser = message.sender_type === "user" && !message.is_ai_generated;
                const isContact = message.sender_type === "contact";
                const isSystem = message.sender_type === "system";
                const isAI = message.is_ai_generated;

                // FASE 5: Mensagem de Sistema (centralizada)
                if (isSystem) {
                  return (
                    <div key={message.id} className="flex justify-center py-2">
                      <p className="text-xs text-muted-foreground text-center max-w-md">
                        📢 {message.content}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      isContact ? "justify-start" : "justify-end"
                    )}
                  >
                    {/* FASE 5: Avatar e Nome para mensagens não-contato */}
                    {!isContact && (
                      <div className="flex flex-col items-center gap-1">
                        {isAI ? (
                          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground">
                            🤖
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                            {message.sender?.full_name
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      {/* FASE 5: Nome do Remetente */}
                      {!isContact && (
                        <div className="text-xs text-muted-foreground px-1">
                          {isAI ? (
                            <span className="font-medium">Assistente Virtual</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{message.sender?.full_name || "Atendente"}</span>
                              {message.sender?.job_title && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  {message.sender.job_title}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg px-4 py-2",
                          isContact
                            ? "bg-muted text-foreground"
                            : isAI
                            ? "bg-accent/50 border border-accent"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <span className="text-xs opacity-70 mt-1 block">
                          {format(new Date(message.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border bg-card p-4 space-y-3">
          {/* Card de Sugestão Copilot */}
          {isCopilot && conversation && (
            <CopilotSuggestionCard 
              conversationId={conversation.id}
              onUseSuggestion={handleUseSuggestion}
            />
          )}

          {!isEmailMode && !isAutopilot && (
            <p className="text-xs text-muted-foreground px-1">
              💬 Mensagens do chat são apenas internas (WhatsApp não configurado)
            </p>
          )}
          
          {/* Input bloqueado em autopilot */}
          {isAutopilot ? (
            <div className="relative">
              <div className="absolute inset-0 bg-muted/50 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                <p className="text-sm font-medium text-foreground">
                  🤖 IA está respondendo automaticamente
                </p>
              </div>
              <form className="flex flex-col gap-2 opacity-50 pointer-events-none">
                <div className="flex gap-2">
                  <Input
                    value=""
                    placeholder="Digite uma mensagem..."
                    className="flex-1"
                    disabled
                  />
                  <Button type="submit" size="icon" disabled>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
              {isEmailMode && (
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Assunto do email..."
                  className="w-full"
                  disabled={sendEmail.isPending}
                />
              )}
              <div className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={isEmailMode ? "Corpo do email..." : "Digite uma mensagem..."}
                  className="flex-1"
                  disabled={sendMessage.isPending || sendEmail.isPending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={
                    !messageText.trim() || 
                    (isEmailMode && !emailSubject.trim()) ||
                    sendMessage.isPending || 
                    sendEmail.isPending
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
