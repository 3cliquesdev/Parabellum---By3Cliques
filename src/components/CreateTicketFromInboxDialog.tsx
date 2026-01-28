import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateTicketFromConversation } from "@/hooks/useGenerateTicketFromConversation";
import { useUsers } from "@/hooks/useUsers";
import { useMessages } from "@/hooks/useMessages";
import { useAISummary } from "@/hooks/useAISummary";
import { Clock, AlertCircle, MessageSquare, User, Tag, FileText, StickyNote, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreateTicketFromInboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  contactName: string;
}

const CATEGORY_OPTIONS = [
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'bug', label: 'Bug' },
  { value: 'outro', label: 'Outro' },
] as const;

const PRIORITY_OPTIONS = [
  { 
    value: 'urgent', 
    label: 'Urgente',
    sla: '4 horas',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  },
  { 
    value: 'high', 
    label: 'Alta',
    sla: '8 horas',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20'
  },
  { 
    value: 'medium', 
    label: 'Média',
    sla: '24 horas',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20'
  },
  { 
    value: 'low', 
    label: 'Baixa',
    sla: '48 horas',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20'
  },
] as const;

export function CreateTicketFromInboxDialog({
  open,
  onOpenChange,
  conversationId,
  contactName,
}: CreateTicketFromInboxDialogProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<'financeiro' | 'tecnico' | 'bug' | 'outro'>('outro');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);
  const [internalNote, setInternalNote] = useState("");

  const generateTicket = useGenerateTicketFromConversation();
  const { data: users } = useUsers();
  const { data: messages } = useMessages(conversationId);
  const aiSummary = useAISummary();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSubject("");
      setDescription("");
      setCategory('outro');
      setPriority('medium');
      setAssignedTo(undefined);
      setInternalNote("");
    }
  }, [open]);

  // Get last 10 messages for preview
  const recentMessages = messages?.slice(-10).reverse() || [];
  
  // Get selected priority details
  const selectedPriority = PRIORITY_OPTIONS.find(p => p.value === priority);

  // Filter online/active users (in real scenario, you'd check actual status)
  const availableUsers = users?.filter(u => u.id) || [];

  const handleAISummary = () => {
    if (!messages || messages.length === 0) return;

    const formattedMessages = messages.map(m => ({
      content: m.content,
      sender_type: m.sender_type as 'user' | 'contact'
    }));

    aiSummary.mutate(formattedMessages, {
      onSuccess: (result) => {
        // Extract category suggestion from AI response
        const categoryMatch = result.match(/Categoria sugerida:\s*(\w+)/i);
        if (categoryMatch) {
          const suggestedCategory = categoryMatch[1].toLowerCase();
          if (['financeiro', 'tecnico', 'bug', 'outro'].includes(suggestedCategory)) {
            setCategory(suggestedCategory as any);
          }
        }

        // Extract summary and set as description
        const summaryMatch = result.match(/Resumo:([\s\S]*?)(?=Categoria sugerida:|$)/i);
        if (summaryMatch) {
          setDescription(summaryMatch[1].trim());
        }
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!conversationId || !subject.trim()) {
      return;
    }

    generateTicket.mutate(
      {
        conversation_id: conversationId,
        subject: subject.trim(),
        description: description.trim() || undefined,
        category,
        priority,
        assigned_to: assignedTo || undefined,
        internal_note: internalNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Criar Ticket a partir da Conversa
          </DialogTitle>
          <DialogDescription>
            Gerar ticket de suporte para <strong>{contactName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4">
            <div className="grid grid-cols-2 gap-4 pb-4">
              {/* Subject */}
              <div className="col-span-2">
                <Label htmlFor="subject" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Assunto *
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Problema com pagamento de fatura"
                  required
                  className="mt-1"
                />
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Categoria *
                </Label>
                <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                  <SelectTrigger id="category" className="mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority with SLA Visual */}
              <div>
                <Label htmlFor="priority" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Prioridade * (SLA)
                </Label>
                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <SelectTrigger id="priority" className="mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                    {PRIORITY_OPTIONS.map((prio) => (
                      <SelectItem key={prio.value} value={prio.value}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{prio.label}</span>
                          <Badge variant="outline" className={`${prio.bgColor} ${prio.color} text-xs`}>
                            <Clock className="h-3 w-3 mr-1" />
                            {prio.sla}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPriority && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    SLA: Resolver em até <strong>{selectedPriority.sla}</strong>
                  </p>
                )}
              </div>

              {/* Assignee (Intelligent) */}
              <div className="col-span-2">
                <Label htmlFor="assignee" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Atribuir a (Opcional)
                </Label>
                <Select value={assignedTo || undefined} onValueChange={(val) => setAssignedTo(val || undefined)}>
                  <SelectTrigger id="assignee" className="mt-1 bg-background">
                    <SelectValue placeholder="Selecione um agente (opcional)..." />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.full_name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {user.role || 'user'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description with AI Summary */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Descrição Adicional (Opcional)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAISummary}
                    disabled={aiSummary.isPending || !messages || messages.length === 0}
                    className="h-8"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {aiSummary.isPending ? "Resumindo..." : "Resumir com AI"}
                  </Button>
                </div>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione detalhes sobre o problema ou clique em 'Resumir com AI'..."
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>

              {/* Internal Note (Yellow Field) */}
              <div className="col-span-2">
                <Label htmlFor="internal-note" className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <StickyNote className="h-4 w-4" />
                  Nota Interna (Visível apenas para equipe)
                </Label>
                <Textarea
                  id="internal-note"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Ex: Cliente está muito irritado, cuidado no atendimento..."
                  rows={2}
                  className="mt-1 resize-none bg-yellow-50 dark:bg-yellow-900/10 border-yellow-300 dark:border-yellow-700 focus-visible:ring-yellow-500"
                />
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                  ⚠️ Esta nota não será visível para o cliente
                </p>
              </div>

              {/* Messages Preview */}
              <div className="col-span-2 border rounded-lg p-3 bg-muted/30">
                <Label className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Preview das Últimas Mensagens ({recentMessages.length})
                </Label>
                <ScrollArea className="h-40">
                  <div className="space-y-2 pr-3">
                    {recentMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        Nenhuma mensagem disponível
                      </p>
                    ) : (
                      recentMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`text-xs p-2 rounded ${
                            msg.sender_type === 'contact'
                              ? 'bg-primary/10 text-primary-foreground/90'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">
                              {msg.sender_type === 'contact' ? 'Cliente' : 'Agente'}
                            </span>
                            <span className="text-muted-foreground">
                              {format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-foreground/90">{msg.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground mt-2">
                  Estas mensagens serão incluídas automaticamente no ticket
                </p>
              </div>
            </div>
          </ScrollArea>

          {/* Actions - Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generateTicket.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={generateTicket.isPending || !subject.trim()}
            >
              {generateTicket.isPending ? "Gerando..." : "Gerar Ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
