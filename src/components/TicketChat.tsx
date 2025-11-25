import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTicketComments } from "@/hooks/useTicketComments";
import { useCreateComment } from "@/hooks/useCreateComment";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketChatProps {
  ticketId: string;
}

export function TicketChat({ ticketId }: TicketChatProps) {
  const [message, setMessage] = useState("");
  const { data: comments = [] } = useTicketComments(ticketId);
  const createComment = useCreateComment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    await createComment.mutateAsync({
      ticket_id: ticketId,
      content: message.trim(),
      is_internal: false,
    });

    setMessage("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Comentários</CardTitle>
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
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua resposta..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={!message.trim() || createComment.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
