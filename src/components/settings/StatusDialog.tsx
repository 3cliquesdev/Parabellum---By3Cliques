import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  useCreateTicketStatus, 
  useUpdateTicketStatus,
  type TicketStatus,
  type CreateTicketStatusData 
} from "@/hooks/useTicketStatuses";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import {
  Inbox,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  Loader2,
  Archive,
  FolderOpen,
  User,
  MessageSquare,
  Send,
  Eye,
  Pause,
  Play,
  RefreshCw,
  Timer,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Star,
  Zap,
} from "lucide-react";

interface StatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: TicketStatus | null;
}

const ICON_OPTIONS = [
  { value: 'inbox', label: 'Caixa de Entrada', icon: Inbox },
  { value: 'clock', label: 'Relógio', icon: Clock },
  { value: 'alert-circle', label: 'Alerta', icon: AlertCircle },
  { value: 'check-circle', label: 'Check', icon: CheckCircle },
  { value: 'x-circle', label: 'X', icon: XCircle },
  { value: 'alert-triangle', label: 'Triângulo', icon: AlertTriangle },
  { value: 'circle', label: 'Círculo', icon: Circle },
  { value: 'archive', label: 'Arquivo', icon: Archive },
  { value: 'folder-open', label: 'Pasta', icon: FolderOpen },
  { value: 'user', label: 'Usuário', icon: User },
  { value: 'message-square', label: 'Mensagem', icon: MessageSquare },
  { value: 'send', label: 'Enviar', icon: Send },
  { value: 'eye', label: 'Visualização', icon: Eye },
  { value: 'pause', label: 'Pausar', icon: Pause },
  { value: 'play', label: 'Reproduzir', icon: Play },
  { value: 'refresh-cw', label: 'Atualizar', icon: RefreshCw },
  { value: 'timer', label: 'Cronômetro', icon: Timer },
  { value: 'ban', label: 'Bloqueado', icon: Ban },
  { value: 'thumbs-up', label: 'Positivo', icon: ThumbsUp },
  { value: 'thumbs-down', label: 'Negativo', icon: ThumbsDown },
  { value: 'flag', label: 'Bandeira', icon: Flag },
  { value: 'star', label: 'Estrela', icon: Star },
  { value: 'zap', label: 'Raio', icon: Zap },
];

const COLOR_PRESETS = [
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#6B7280', // Gray
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#84CC16', // Lime
];

export function StatusDialog({ open, onOpenChange, status }: StatusDialogProps) {
  const createMutation = useCreateTicketStatus();
  const updateMutation = useUpdateTicketStatus();
  const isEditing = !!status;

  const { data: emailTemplates } = useEmailTemplates();

  const [formData, setFormData] = useState<CreateTicketStatusData>({
    name: '',
    label: '',
    description: '',
    color: '#3B82F6',
    icon: 'circle',
    is_active: true,
    is_archived_status: false,
    is_final_status: false,
    send_email_notification: false,
    send_whatsapp_notification: false,
    email_template_id: null,
  });

  useEffect(() => {
    if (status) {
      setFormData({
        name: status.name,
        label: status.label,
        description: status.description || '',
        color: status.color,
        icon: status.icon,
        is_active: status.is_active,
        is_archived_status: status.is_archived_status,
        is_final_status: status.is_final_status,
        send_email_notification: status.send_email_notification,
        send_whatsapp_notification: status.send_whatsapp_notification,
        email_template_id: status.email_template_id,
      });
    } else {
      setFormData({
        name: '',
        label: '',
        description: '',
        color: '#3B82F6',
        icon: 'circle',
        is_active: true,
        is_archived_status: false,
        is_final_status: false,
        send_email_notification: false,
        send_whatsapp_notification: false,
        email_template_id: null,
      });
    }
  }, [status, open]);

  const handleLabelChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      label: value,
      // Auto-generate name from label if not editing
      name: isEditing ? prev.name : value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, ''),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.label) return;

    try {
      if (isEditing && status) {
        await updateMutation.mutateAsync({
          id: status.id,
          updates: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const SelectedIcon = ICON_OPTIONS.find(i => i.value === formData.icon)?.icon || Circle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Status' : 'Novo Status de Ticket'}
            </DialogTitle>
            <DialogDescription>
              Configure as propriedades do status de ticket.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Nome de Exibição *</Label>
              <Input
                id="label"
                placeholder="Ex: Em Análise"
                value={formData.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Nome que aparece para os usuários
              </p>
            </div>

            {/* Name (system) */}
            <div className="space-y-2">
              <Label htmlFor="name">Identificador do Sistema *</Label>
              <Input
                id="name"
                placeholder="ex: em_analise"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                pattern="^[a-z0-9_]+$"
                title="Apenas letras minúsculas, números e underscores"
                required
                disabled={isEditing}
              />
              <p className="text-xs text-muted-foreground">
                Usado internamente. Não pode ser alterado após criação.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição do status..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Color & Icon */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-md border border-border"
                    style={{ backgroundColor: formData.color }}
                  />
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-16 h-8 p-0 border-0"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <SelectedIcon className="w-4 h-4" />
                        <span>{ICON_OPTIONS.find(i => i.value === formData.icon)?.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(option => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Behavior */}
            <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
              <Label className="text-sm font-medium">Comportamento</Label>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="text-sm font-normal">Ativo</Label>
                  <p className="text-xs text-muted-foreground">Disponível para seleção</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_archived" className="text-sm font-normal">Status de Arquivamento</Label>
                  <p className="text-xs text-muted-foreground">Tickets aparecem na seção arquivados</p>
                </div>
                <Switch
                  id="is_archived"
                  checked={formData.is_archived_status}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_archived_status: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_final" className="text-sm font-normal">Status Final</Label>
                  <p className="text-xs text-muted-foreground">Não pode ser alterado depois</p>
                </div>
                <Switch
                  id="is_final"
                  checked={formData.is_final_status}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_final_status: checked }))}
                />
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
              <Label className="text-sm font-medium">Notificações ao Cliente</Label>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="send_email" className="text-sm font-normal">Enviar Email</Label>
                  <p className="text-xs text-muted-foreground">Notificar cliente por email</p>
                </div>
                <Switch
                  id="send_email"
                  checked={formData.send_email_notification}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_email_notification: checked }))}
                />
              </div>

              {formData.send_email_notification && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label htmlFor="email_template" className="text-sm font-normal">Template de E-mail</Label>
                  <Select
                    value={formData.email_template_id || "none"}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      email_template_id: value === "none" ? null : value 
                    }))}
                  >
                    <SelectTrigger id="email_template">
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Usar template padrão do sistema</SelectItem>
                      {emailTemplates?.filter(t => t.is_active).map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Template específico para este status (opcional)
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="send_whatsapp" className="text-sm font-normal">Enviar WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">Em breve</p>
                </div>
                <Switch
                  id="send_whatsapp"
                  checked={formData.send_whatsapp_notification}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_whatsapp_notification: checked }))}
                  disabled
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Criar Status'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
