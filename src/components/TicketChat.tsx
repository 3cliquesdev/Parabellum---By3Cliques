import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTicketComments } from "@/hooks/useTicketComments";
import { useCreateComment } from "@/hooks/useCreateComment";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SafeHTML } from "@/components/SafeHTML";
import { ChannelBadge } from "@/components/ChannelBadge";
import { useToast } from "@/hooks/use-toast";

interface TicketChatProps {
  ticketId: string;
  channel?: string;
}

export function TicketChat({ ticketId, channel = 'platform' }: TicketChatProps) {
  const [message, setMessage] = useState("");
  const { data: comments = [] } = useTicketComments(ticketId);
  const createComment = useCreateComment();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Criar comentário no ticket
    await createComment.mutateAsync({
      ticket_id: ticketId,
      content: message.trim(),
      is_internal: false,
    });

    // Sempre enviar email para o cliente em comentários públicos
    try {
      const { error } = await supabase.functions.invoke('send-ticket-email-reply', {
        body: {
          ticket_id: ticketId,
          message_content: message.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: "📧 Email enviado",
        description: "Sua resposta foi enviada por email ao cliente",
      });
    } catch (error: any) {
      console.error('[TicketChat] Email send error:', error);
      toast({
        title: "Aviso",
        description: "Comentário salvo. Email não enviado (cliente sem email ou erro).",
        variant: "default",
      });
    }

    setMessage("");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Comentários</CardTitle>
          <ChannelBadge channel={channel} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum comentário ainda. Seja o primeiro a responder!
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.created_by_user?.avatar_url} />
                    <AvatarFallback>
                      {comment.created_by_user?.full_name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm">
                        {comment.created_by_user?.full_name || 'Usuário'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <SafeHTML 
                      html={comment.content}
                      className="text-sm whitespace-pre-wrap"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="space-y-2">
          <SlashCommandMenu value={message} onChange={setMessage}>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua resposta ou / para macros..."
              rows={3}
            />
          </SlashCommandMenu>
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={!message.trim() || createComment.isPending}
            >
              <Mail className="w-4 h-4 mr-2" />
              Enviar Resposta
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
