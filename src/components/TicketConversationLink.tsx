import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMessages } from "@/hooks/useMessages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TicketConversationLinkProps {
  conversationId: string | null;
  conversationChannel?: string;
  conversationCreatedAt?: string;
}

export function TicketConversationLink({ 
  conversationId, 
  conversationChannel = 'web_chat',
  conversationCreatedAt 
}: TicketConversationLinkProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: messages = [] } = useMessages(sheetOpen ? conversationId : null);

  if (!conversationId) return null;

  const channelIcons: Record<string, string> = {
    web_chat: '💬',
    whatsapp: '📱',
    email: '📧',
  };

  const channelNames: Record<string, string> = {
    web_chat: 'Chat Web',
    whatsapp: 'WhatsApp',
    email: 'Email',
  };

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Origem do Ticket</span>
                  <Badge variant="secondary" className="text-xs">
                    {channelIcons[conversationChannel]} {channelNames[conversationChannel]}
                  </Badge>
                </div>
                {conversationCreatedAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(conversationCreatedAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Este ticket foi gerado a partir de uma conversa com o cliente
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSheetOpen(true)}
              className="shrink-0"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver Conversa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversation History Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Histórico da Conversa</SheetTitle>
            <SheetDescription>
              Conversa completa que originou este ticket
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma mensagem encontrada
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.sender_type === 'customer' ? 'flex-row' : 'flex-row-reverse'
                  }`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={message.sender_type === 'user' ? message.sender_avatar : undefined} />
                    <AvatarFallback>
                      {message.sender_type === 'customer' ? '👤' : '🤖'}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`flex-1 rounded-lg p-3 ${
                      message.sender_type === 'customer'
                        ? 'bg-muted'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {format(new Date(message.created_at), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
