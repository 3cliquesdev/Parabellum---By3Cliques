import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  User,
  Headphones
} from "lucide-react";

interface TicketComment {
  id: string;
  content: string;
  created_at: string;
  source: string | null;
  author_name: string;
  is_customer: boolean;
}

interface CustomerTicket {
  id: string;
  ticket_number: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  first_response_at: string | null;
  department: { id: string; name: string } | null;
  comments: TicketComment[];
  comment_count: number;
}

interface MyTicketDetailProps {
  ticket: CustomerTicket;
  contactId: string;
  onBack: () => void;
  onCommentAdded: () => void;
  customerName: string;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  open: { label: "Aberto", icon: <AlertCircle className="w-4 h-4" />, className: "text-blue-500" },
  in_progress: { label: "Em Andamento", icon: <Clock className="w-4 h-4" />, className: "text-yellow-500" },
  pending: { label: "Pendente", icon: <Clock className="w-4 h-4" />, className: "text-orange-500" },
  resolved: { label: "Resolvido", icon: <CheckCircle2 className="w-4 h-4" />, className: "text-green-500" },
  closed: { label: "Fechado", icon: <CheckCircle2 className="w-4 h-4" />, className: "text-muted-foreground" },
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export default function MyTicketDetail({ 
  ticket, 
  contactId, 
  onBack, 
  onCommentAdded,
  customerName 
}: MyTicketDetailProps) {
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const status = statusConfig[ticket.status] || statusConfig.open;
  const ticketNumber = ticket.ticket_number || ticket.id.substring(0, 8).toUpperCase();
  const isClosed = ticket.status === "closed";

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('add-customer-comment', {
        body: {
          ticket_id: ticket.id,
          contact_id: contactId,
          content: newComment.trim()
        }
      });

      if (error) throw error;

      if (data.success) {
        setNewComment("");
        toast({
          title: "Resposta enviada",
          description: "Sua mensagem foi adicionada ao ticket.",
        });
        onCommentAdded();
      } else {
        throw new Error(data.error || "Erro ao enviar resposta");
      }
    } catch (error: unknown) {
      console.error('Error sending comment:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível enviar sua resposta.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">
                #{ticketNumber}
              </span>
              <div className={`flex items-center gap-1 ${status.className}`}>
                {status.icon}
                <span className="text-sm font-medium">{status.label}</span>
              </div>
            </div>
            <h1 className="font-semibold line-clamp-1">{ticket.subject}</h1>
          </div>
        </div>

        {/* Ticket Info Card */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detalhes do Ticket</CardTitle>
              <Badge variant="outline">{priorityLabels[ticket.priority] || ticket.priority}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Descrição</p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => (
                      <span className="font-semibold text-foreground">{children}</span>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 leading-relaxed text-sm text-foreground/90">{children}</p>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" 
                         className="text-primary hover:underline">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {ticket.description}
                </ReactMarkdown>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Criado em</p>
                <p>{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
              {ticket.resolved_at && (
                <div>
                  <p className="text-muted-foreground mb-1">Resolvido em</p>
                  <p>{format(new Date(ticket.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              )}
              {ticket.department && (
                <div>
                  <p className="text-muted-foreground mb-1">Departamento</p>
                  <p>{ticket.department.name}</p>
                </div>
              )}
              {ticket.category && (
                <div>
                  <p className="text-muted-foreground mb-1">Categoria</p>
                  <p className="capitalize">{ticket.category}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline / Comments */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Mensagens</CardTitle>
          </CardHeader>
          <CardContent>
            {ticket.comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma mensagem ainda.</p>
                <p className="text-sm">Aguardando resposta da equipe de suporte.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-4">
                  {ticket.comments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className={`flex gap-3 ${comment.is_customer ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        comment.is_customer 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {comment.is_customer ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Headphones className="w-4 h-4" />
                        )}
                      </div>
                      <div className={`flex-1 max-w-[80%] ${comment.is_customer ? 'text-right' : ''}`}>
                        <div className={`inline-block rounded-lg p-3 ${
                          comment.is_customer 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {comment.is_customer ? 'Você' : comment.author_name} • {
                            format(new Date(comment.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Reply Box */}
        {!isClosed ? (
          <Card>
            <CardContent className="p-4">
              <Textarea
                placeholder="Digite sua resposta..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="mb-3 min-h-[100px]"
                disabled={sending}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleSendComment} 
                  disabled={!newComment.trim() || sending}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar Resposta
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              <p>Este ticket foi fechado e não aceita mais respostas.</p>
              <Button variant="outline" className="mt-3" onClick={onBack}>
                Voltar aos Tickets
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
