import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMessages, useSendMessage } from "@/hooks/useMessages";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading } = useMessages(conversation?.id || null);
  const sendMessage = useSendMessage();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversation) return;

    await sendMessage.mutateAsync({
      conversation_id: conversation.id,
      content: messageText.trim(),
      sender_type: "user",
    });

    setMessageText("");
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
      <div className="h-16 border-b border-border bg-card flex items-center px-4 gap-3">
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
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!messageText.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
