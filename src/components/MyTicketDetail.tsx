import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  Headphones,
  Paperclip,
  Download,
  ArrowRightLeft,
  Image as ImageIcon,
  X,
  FileText,
  Film
} from "lucide-react";

interface TicketAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface TicketComment {
  id: string;
  content: string;
  created_at: string;
  source: string | null;
  author_name: string;
  is_customer: boolean;
  attachments?: TicketAttachment[];
}

interface TicketEvent {
  id: string;
  event_type: string;
  created_at: string;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, any>;
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
  events?: TicketEvent[];
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
  waiting_customer: { label: "Aguardando Cliente", icon: <AlertCircle className="w-4 h-4" />, className: "text-yellow-500" },
  pending: { label: "Pendente", icon: <Clock className="w-4 h-4" />, className: "text-orange-500" },
  pending_approval: { label: "Aguard. Aprovação", icon: <Clock className="w-4 h-4" />, className: "text-yellow-600" },
  resolved: { label: "Resolvido", icon: <CheckCircle2 className="w-4 h-4" />, className: "text-green-500" },
  closed: { label: "Fechado", icon: <CheckCircle2 className="w-4 h-4" />, className: "text-muted-foreground" },
  returned: { label: "Devolvido", icon: <AlertCircle className="w-4 h-4" />, className: "text-orange-500" },
  loja_bloqueada: { label: "Loja Bloqueada", icon: <AlertCircle className="w-4 h-4" />, className: "text-red-500" },
  loja_concluida: { label: "Loja Concluída", icon: <CheckCircle2 className="w-4 h-4" />, className: "text-green-500" },
  approved: { label: "Aprovado", icon: <CheckCircle2 className="w-4 h-4" />, className: "text-blue-600" },
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const statusEventLabels: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em Análise',
  waiting_customer: 'Aguardando Cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
  pending_approval: 'Aguard. Aprovação',
  returned: 'Devolvido',
  loja_bloqueada: 'Loja Bloqueada',
  loja_concluida: 'Loja Concluída',
  approved: 'Aprovado',
};

function getEventLabel(event: TicketEvent): string {
  if (event.event_type === 'status_changed') {
    const from = statusEventLabels[event.old_value || ''] || event.old_value;
    const to = statusEventLabels[event.new_value || ''] || event.new_value;
    return `Status alterado de ${from} para ${to}`;
  }
  if (event.event_type === 'resolved') return 'Ticket resolvido';
  if (event.event_type === 'closed') return 'Ticket fechado';
  if (event.event_type === 'assigned') return 'Ticket atribuído a um agente';
  return 'Atualização do ticket';
}

type TimelineItem = { type: 'comment'; data: TicketComment; date: Date } | { type: 'event'; data: TicketEvent; date: Date };

function mergeTimelineItems(comments: TicketComment[], events: TicketEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...comments.map(c => ({ type: 'comment' as const, data: c, date: new Date(c.created_at) })),
    ...events.map(e => ({ type: 'event' as const, data: e, date: new Date(e.created_at) })),
  ];
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  return items;
}

export default function MyTicketDetail({
  ticket, 
  contactId, 
  onBack, 
  onCommentAdded,
  customerName 
}: MyTicketDetailProps) {
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/quicktime'];
  const MAX_SIZE = 10 * 1024 * 1024;

  const status = statusConfig[ticket.status] || statusConfig.open;
  const ticketNumber = ticket.ticket_number || ticket.id.substring(0, 8).toUpperCase();
  const isClosed = ticket.status === "closed";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: "Tipo não permitido", description: `${file.name}: use JPG, PNG, WEBP, GIF, PDF, MP4 ou MOV.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast({ title: "Arquivo grande demais", description: `${file.name}: máximo 10MB.`, variant: "destructive" });
        continue;
      }
      valid.push(file);
    }
    setSelectedFiles(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<TicketAttachment[]> => {
    const attachments: TicketAttachment[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      setUploadProgress(Math.round(((i) / selectedFiles.length) * 100));
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/upload-ticket-attachment`, {
        method: 'POST',
        headers: { 'apikey': anonKey },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || `Falha ao enviar ${file.name}`);
      }

      const result = await res.json();
      attachments.push({ url: result.url, name: result.name, type: result.type, size: result.size });
    }
    setUploadProgress(100);
    return attachments;
  };

  const handleSendComment = async () => {
    if (!newComment.trim() && selectedFiles.length === 0) return;
    
    if (!contactId) {
      console.error('[MyTicketDetail] contactId está vazio ou undefined');
      toast({ title: "Erro de identificação", description: "Sua sessão expirou. Por favor, volte e identifique-se novamente.", variant: "destructive" });
      return;
    }
    
    setSending(true);
    try {
      let attachments: TicketAttachment[] = [];

      // Upload files first
      if (selectedFiles.length > 0) {
        setUploading(true);
        attachments = await uploadFiles();
        setUploading(false);
      }

      const content = newComment.trim() || (attachments.length > 0 ? `📎 ${attachments.length} anexo(s) enviado(s)` : '');

      console.log('[MyTicketDetail] Enviando comentário:', {
        ticket_id: ticket.id,
        contact_id: contactId,
        content_length: content.length,
        attachments_count: attachments.length,
      });

      const { data, error } = await supabase.functions.invoke('add-customer-comment', {
        body: {
          ticket_id: ticket.id,
          contact_id: contactId,
          content,
          attachments: attachments.length > 0 ? attachments : undefined,
        }
      });

      if (error) throw error;

      if (data?.error) {
        if (data.error === 'Unauthorized') throw new Error('Você não tem permissão para comentar neste ticket.');
        if (data.error === 'Ticket not found') throw new Error('Ticket não encontrado.');
        if (data.error === 'Cannot add comment to closed ticket') throw new Error('Não é possível comentar em um ticket fechado.');
        throw new Error(data.error);
      }

      if (data?.success) {
        setNewComment("");
        setSelectedFiles([]);
        toast({ title: "Resposta enviada", description: "Sua mensagem foi adicionada ao ticket." });
        onCommentAdded();
      } else {
        throw new Error("Resposta inesperada do servidor");
      }
    } catch (error: unknown) {
      console.error('[MyTicketDetail] Erro completo:', error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Não foi possível enviar sua resposta. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Film className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
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
            {ticket.comments.length === 0 && (!ticket.events || ticket.events.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma mensagem ainda.</p>
                <p className="text-sm">Aguardando resposta da equipe de suporte.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-4">
                  {/* Merge comments and events by date */}
                  {mergeTimelineItems(ticket.comments, ticket.events || []).map((item) => {
                    if (item.type === 'event') {
                      const evt = item.data as TicketEvent;
                      return (
                        <div key={`event-${evt.id}`} className="flex justify-center">
                          <div className="flex items-center gap-2 bg-muted/50 rounded-full px-4 py-1.5 text-xs text-muted-foreground">
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>{getEventLabel(evt)}</span>
                            <span>• {format(new Date(evt.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                        </div>
                      );
                    }

                    const comment = item.data as TicketComment;
                    return (
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
                            {/* Attachments */}
                            {comment.attachments && comment.attachments.length > 0 && (
                              <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                                {comment.attachments.map((att, idx) => {
                                  const isImage = att.type?.startsWith('image/');
                                  return (
                                    <div key={idx}>
                                      {isImage ? (
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                          <img 
                                            src={att.url} 
                                            alt={att.name} 
                                            className="max-w-[200px] rounded border cursor-pointer hover:opacity-80 transition-opacity" 
                                          />
                                        </a>
                                      ) : (
                                        <a 
                                          href={att.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={`flex items-center gap-2 text-xs hover:underline ${
                                            comment.is_customer ? 'text-primary-foreground/80' : 'text-foreground/70'
                                          }`}
                                        >
                                          <Paperclip className="w-3 h-3" />
                                          <span className="truncate max-w-[150px]">{att.name}</span>
                                          <Download className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {comment.is_customer ? 'Você' : comment.author_name} • {
                              format(new Date(comment.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                            }
                          </p>
                        </div>
                      </div>
                    );
                  })}
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

              {/* Selected files preview */}
              {selectedFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-muted rounded-lg p-2 text-sm">
                      {getFileIcon(file.type)}
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(idx)}
                        disabled={sending}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload progress */}
              {uploading && (
                <div className="mb-3 space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">Enviando arquivos... {uploadProgress}%</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/quicktime"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                  >
                    <Paperclip className="w-4 h-4 mr-1" />
                    Anexar
                  </Button>
                </div>
                <Button 
                  onClick={handleSendComment} 
                  disabled={(!newComment.trim() && selectedFiles.length === 0) || sending}
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
