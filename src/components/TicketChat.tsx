import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpdateTicket } from "@/hooks/useUpdateTicket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTicketComments } from "@/hooks/useTicketComments";
import { useCreateComment } from "@/hooks/useCreateComment";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, MessageSquare, Paperclip, FileText, Image, File, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SafeHTML } from "@/components/SafeHTML";
import { ChannelBadge } from "@/components/ChannelBadge";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

// Tipo para anexos de comentário
interface CommentAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

// Helper para formatar tamanho de arquivo
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper para ícone baseado no tipo
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  return File;
}

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
  const queryClient = useQueryClient();
  const updateTicket = useUpdateTicket();

  // Realtime subscription para novos comentários
  useEffect(() => {
    if (!ticketId) return;

    const realtimeChannel = supabase
      .channel(`ticket-comments:${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          console.log('[TicketChat] Novo comentário recebido via realtime:', payload);
          // Invalida a query para refetch com dados enriquecidos
          queryClient.invalidateQueries({ 
            queryKey: ['ticket-comments', ticketId] 
          });
        }
      )
      .subscribe((status) => {
        console.log(`[TicketChat] Realtime status for ${ticketId}:`, status);
      });

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [ticketId, queryClient]);

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

        // Auto-transition: atualizar status para waiting_customer se aplicável
        try {
          const { data: currentTicket } = await supabase
            .from("tickets")
            .select("status")
            .eq("id", ticketId)
            .single();

          const autoTransitionStatuses = ['open', 'in_progress'];
          if (currentTicket && autoTransitionStatuses.includes(currentTicket.status)) {
            await updateTicket.mutateAsync({
              id: ticketId,
              updates: { status: 'waiting_customer' },
              statusNote: 'Status atualizado automaticamente após resposta do agente',
            });
            console.log('[TicketChat] Auto-transition to waiting_customer');
          }
        } catch (transitionErr) {
          console.error('[TicketChat] Auto-transition error:', transitionErr);
        }
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
              comments.map((comment) => {
                const isCustomer = comment.is_customer_comment;
                const isInternal = comment.is_internal;
                
                return (
                  <div 
                    key={comment.id} 
                    className={`flex gap-3 p-3 rounded-lg ${
                      isInternal 
                        ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' 
                        : isCustomer
                          ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                          : ''
                    } ${isCustomer ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="w-8 h-8">
                      {isCustomer ? (
                        <AvatarFallback className="bg-blue-500 text-white">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={comment.created_by_user?.avatar_url} />
                          <AvatarFallback>
                            {comment.display_name?.[0] || '?'}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>

                    <div className={`flex-1 space-y-1 ${isCustomer ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 flex-wrap ${isCustomer ? 'justify-end' : ''}`}>
                        <span className="font-medium text-sm">
                          {comment.display_name || 'Usuário'}
                        </span>
                        {isCustomer && (
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700">
                            <User className="w-3 h-3 mr-1" />
                            Cliente
                          </Badge>
                        )}
                        {isInternal && (
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
                        className={`text-sm whitespace-pre-wrap ${isCustomer ? 'text-left' : ''}`}
                      />
                      
                      {/* Renderizar anexos se existirem */}
                      {comment.attachments && Array.isArray(comment.attachments) && comment.attachments.length > 0 && (
                        <div className={`flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50 ${isCustomer ? 'justify-end' : ''}`}>
                          {(comment.attachments as unknown as CommentAttachment[]).map((att, idx) => {
                            const FileIcon = getFileIcon(att.type);
                            const isImage = att.type.startsWith('image/');
                            
                            return (
                              <a 
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-xs hover:bg-muted/80 transition-colors group"
                              >
                                {isImage ? (
                                  <img 
                                    src={att.url} 
                                    alt={att.name}
                                    className="w-8 h-8 object-cover rounded"
                                  />
                                ) : (
                                  <FileIcon className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                                )}
                                <div className="flex flex-col">
                                  <span className="font-medium truncate max-w-[150px]">{att.name}</span>
                                  <span className="text-muted-foreground">{formatFileSize(att.size)}</span>
                                </div>
                                <Paperclip className="w-3 h-3 text-muted-foreground ml-1" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
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
              placeholder={isInternal ? "Digite uma nota interna... (Ctrl+M para macros)" : "Digite sua resposta... (\\ ou Ctrl+M para macros)"}
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
