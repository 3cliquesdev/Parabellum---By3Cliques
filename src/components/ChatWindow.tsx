import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Send, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
import { useSendEmail } from "@/hooks/useSendEmail";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
};

interface ChatWindowProps {
  conversation: Conversation | null;
}

export default function ChatWindow({ conversation }: ChatWindowProps) {
  const [messageText, setMessageText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [isEmailMode, setIsEmailMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading } = useMessages(conversation?.id || null);
  const sendMessage = useSendMessage();
  const sendEmail = useSendEmail();

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

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <p className="text-[#999999]">
          Selecione uma conversa para começar
        </p>
      </div>
    );
  }

  return (
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
          </div>
        </div>
        
        {/* Toggle Email/Chat */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
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
      </div>

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
            {messages?.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.sender_type === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-4 py-2",
                    message.sender_type === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
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
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        {!isEmailMode && (
          <p className="text-xs text-muted-foreground mb-2 px-1">
            💬 Mensagens do chat são apenas internas (WhatsApp não configurado)
          </p>
        )}
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
      </div>
    </div>
  );
}
