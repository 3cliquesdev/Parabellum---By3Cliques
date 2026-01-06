import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTicketComments } from "@/hooks/useTicketComments";
import { useCreateComment } from "@/hooks/useCreateComment";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SafeHTML } from "@/components/SafeHTML";
import { ChannelBadge } from "@/components/ChannelBadge";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface TicketChatProps {
  ticketId: string;
  channel?: string;
}

export function TicketChat({ ticketId, channel = 'platform' }: TicketChatProps) {
  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
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
      is_internal: isInternal,
    });

    if (isInternal) {
      // Nota interna - notificar criador do ticket
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.functions.invoke('notify-internal-comment', {
          body: {
            ticket_id: ticketId,
            comment_content: message.trim(),
            commenter_id: user?.id,
          },
        });
        toast({
          title: "🔒 Nota interna adicionada",
          description: "O criador do ticket foi notificado",
        });
      } catch (error: any) {
        console.error('[TicketChat] Internal notification error:', error);
        toast({
          title: "Nota interna salva",
          description: "Não foi possível notificar o criador.",
          variant: "default",
        });
      }
    } else {
      // Resposta pública - enviar email para o cliente
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
                <div 
                  key={comment.id} 
                  className={`flex gap-3 p-3 rounded-lg ${
                    comment.is_internal 
                      ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' 
                      : ''
                  }`}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.created_by_user?.avatar_url} />
                    <AvatarFallback>
                      {comment.created_by_user?.full_name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {comment.created_by_user?.full_name || 'Usuário'}
                      </span>
                      {comment.is_internal && (
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700">
                          <Lock className="w-3 h-3 mr-1" />
                          Nota Interna
                        </Badge>
                      )}
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

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Toggle público/interno */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              {isInternal ? (
                <Lock className="w-4 h-4 text-amber-600" />
              ) : (
                <MessageSquare className="w-4 h-4 text-primary" />
              )}
              <Label 
                htmlFor="internal-toggle" 
                className={`text-sm font-medium cursor-pointer ${
                  isInternal ? 'text-amber-600' : 'text-foreground'
                }`}
              >
                {isInternal ? 'Nota Interna (não visível para o cliente)' : 'Resposta Pública (enviada por email)'}
              </Label>
            </div>
            <Switch 
              id="internal-toggle"
              checked={isInternal} 
              onCheckedChange={setIsInternal}
            />
          </div>

          <SlashCommandMenu value={message} onChange={setMessage}>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isInternal ? "Digite uma nota interna..." : "Digite sua resposta ou / para macros..."}
              rows={3}
              className={isInternal ? 'border-amber-300 focus:border-amber-400' : ''}
            />
          </SlashCommandMenu>
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={!message.trim() || createComment.isPending}
              variant={isInternal ? "outline" : "default"}
              className={isInternal ? 'border-amber-500 text-amber-700 hover:bg-amber-50' : ''}
            >
              {isInternal ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Salvar Nota Interna
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar Resposta
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
