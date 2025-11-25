import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Mail, MessageCircle, ArrowRightLeft, FileText, Hand, Bot, MessageSquare, CheckCircle } from "lucide-react";
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
import TransferConversationDialog from "@/components/TransferConversationDialog";
import { CreateTicketFromInboxDialog } from "@/components/CreateTicketFromInboxDialog";
import CopilotSuggestionCard from "@/components/CopilotSuggestionCard";
import CloseConversationDialog from "@/components/CloseConversationDialog";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { data: messages = [], isLoading: isMessagesLoading } = useMessages(conversation?.id || null);
  const { data: aiMode, isLoading: aiModeLoading } = useAIMode(conversation?.id || null);
  const { data: activePersona } = useActivePersona(conversation?.id || null);
  const sendMessage = useSendMessage();
  const sendEmail = useSendEmail();
  const takeControl = useTakeControl();
  const returnToAutopilot = useReturnToAutopilot();
  
  // Ativa Autopilot trigger para responder automaticamente
  useAutopilotTrigger(conversation?.id || null);

  const contact = conversation?.contacts;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      await sendMessage.mutateAsync({
        conversation_id: conversation.id,
        content: message.trim(),
        sender_type: "user",
        sender_id: user?.id || null,
      });

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
        </>
      )}
      
      {conversation ? (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
          <div className="flex-none border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 shrink-0">
                {contact?.avatar_url ? (
                  <AvatarImage src={contact.avatar_url} alt={`${contact.first_name} ${contact.last_name}`} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                  {contact?.first_name?.[0] || ''}{contact?.last_name?.[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {contact?.first_name} {contact?.last_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {contact?.email || contact?.phone}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {conversation.assigned_user && (
                    <Badge variant="secondary" className="text-xs">
                      {conversation.assigned_user.full_name}
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
                          {activePersona.name}
                        </Badge>
                      )}
                    </>
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

          <div className="flex-1 min-h-0 overflow-y-auto">
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
                    <div className="text-slate-500 dark:text-slate-400">Carregando mensagens...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-slate-500 dark:text-slate-400">Nenhuma mensagem ainda</div>
                  </div>
                ) : (
                  <div className="space-y-4">
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
                            {isCustomer && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 px-1 font-medium">
                                {contact?.first_name} {contact?.last_name}
                              </p>
                            )}
                            
                            {!isCustomer && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 px-1 font-medium">
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
                                "max-w-[80%] px-4 py-3 shadow-sm",
                                isCustomer
                                  ? "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-tl-none text-slate-800 dark:text-slate-100"
                                  : isAI
                                  ? "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-tr-none text-slate-800 dark:text-slate-100"
                                  : "bg-blue-700 dark:bg-blue-800 text-white rounded-2xl rounded-tr-none"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                              <span className={cn(
                                "text-[10px] mt-1 block",
                                isCustomer || isAI ? "text-slate-400 dark:text-slate-500" : "text-white/70"
                              )}>
                                {format(new Date(message.created_at), "HH:mm")}
                              </span>
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
            <div className="flex-none p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
              <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Bot className="h-4 w-4" />
                <span>Modo Piloto Automático - Digite mensagens desabilitado</span>
              </div>
            </div>
          ) : (
            <>
              {isEmailMode ? (
                <div className="flex-none bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 p-4 space-y-2">
                  <div className="max-w-3xl mx-auto space-y-2">
                    <Input
                      placeholder="Assunto do e-mail"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Digite sua mensagem de e-mail..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="flex-1 min-h-[80px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2">
                      <Button onClick={handleSendMessage} disabled={isSending || !message.trim() || !emailSubject.trim()}>
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar E-mail
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-none bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 p-4">
                  <div className="max-w-3xl mx-auto flex gap-2">
                    <Input
                      placeholder={
                        conversation.status === "closed"
                          ? "Conversa encerrada - não é possível enviar mensagens"
                          : "Digite sua mensagem..."
                      }
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isSending || conversation.status === "closed"}
                      className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                    <Button onClick={handleSendMessage} disabled={isSending || !message.trim() || conversation.status === "closed"}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma conversa para começar</p>
          </div>
        </div>
      )}
    </>
  );
}
