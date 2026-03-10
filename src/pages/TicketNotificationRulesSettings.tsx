import { useState } from 'react';
import { useTicketCategories } from '@/hooks/useTicketCategories';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Mail, Link } from 'lucide-react';

interface TicketNotificationRule {
  id: string;
  ticket_category: string;
  event_type: string;
  email_template_id: string | null;
  is_active: boolean;
  created_at: string;
  email_templates?: {
    name: string;
    subject: string;
  };
}

// Categories are now loaded dynamically from the database

const EVENT_TYPES = [
  { value: 'created', label: 'Ticket Criado', icon: '📬' },
  { value: 'resolved', label: 'Ticket Resolvido', icon: '✅' },
  { value: 'updated', label: 'Ticket Atualizado', icon: '📝' },
  { value: 'assigned', label: 'Ticket Atribuído', icon: '👤' },
];

export default function TicketNotificationRulesSettings() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TicketNotificationRule | null>(null);
  
  const [formData, setFormData] = useState({
    ticket_category: '',
    event_type: '',
    email_template_id: '',
    is_active: true,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['ticket-notification-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_notification_rules')
        .select(`
          *,
          email_templates (
            name,
            subject
          )
        `)
        .order('ticket_category', { ascending: true });
      
      if (error) throw error;
      return data as TicketNotificationRule[];
    }
  });

  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['email-templates-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('ticket_notification_rules')
        .insert({
          ticket_category: data.ticket_category,
          event_type: data.event_type,
          email_template_id: data.email_template_id || null,
          is_active: data.is_active,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-notification-rules'] });
      toast.success('Regra criada com sucesso');
      closeDialog();
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('Já existe uma regra para esta combinação de categoria e evento');
      } else {
        toast.error(error.message || 'Erro ao criar regra');
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('ticket_notification_rules')
        .update({
          email_template_id: data.email_template_id || null,
          is_active: data.is_active,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-notification-rules'] });
      toast.success('Regra atualizada');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar regra');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ticket_notification_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-notification-rules'] });
      toast.success('Regra excluída');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir regra');
    }
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormData({
      ticket_category: '',
      event_type: '',
      email_template_id: '',
      is_active: true,
    });
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({
      ticket_category: '',
      event_type: '',
      email_template_id: '',
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: TicketNotificationRule) => {
    setEditingRule(rule);
    setFormData({
      ticket_category: rule.ticket_category,
      event_type: rule.event_type,
      email_template_id: rule.email_template_id || '',
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.ticket_category || !formData.event_type) {
      toast.error('Selecione categoria e evento');
      return;
    }

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const { data: ticketCategories = [] } = useTicketCategories();

  const getCategoryLabel = (value: string) => 
    ticketCategories.find(c => c.name === value)?.name || value;

  const getEventInfo = (value: string) => 
    EVENT_TYPES.find(e => e.value === value) || { label: value, icon: '📧' };

  // Group rules by category
  const groupedRules = rules.reduce((acc, rule) => {
    if (!acc[rule.ticket_category]) {
      acc[rule.ticket_category] = [];
    }
    acc[rule.ticket_category].push(rule);
    return acc;
  }, {} as Record<string, TicketNotificationRule[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações de Tickets</h1>
          <p className="text-muted-foreground">
            Configure quais emails são enviados automaticamente para cada tipo de ticket
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : Object.keys(groupedRules).length === 0 ? (
        <Card className="p-8 text-center">
          <Link className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhuma regra de notificação configurada
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie regras para enviar emails automaticamente quando tickets forem criados ou resolvidos
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groupedRules).map(([category, categoryRules]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="outline">{getCategoryLabel(category)}</Badge>
                </CardTitle>
                <CardDescription>
                  {categoryRules.length} regra{categoryRules.length !== 1 ? 's' : ''} configurada{categoryRules.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryRules.map(rule => {
                  const eventInfo = getEventInfo(rule.event_type);
                  return (
                    <div 
                      key={rule.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        !rule.is_active ? 'opacity-60 bg-muted/50' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{eventInfo.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{eventInfo.label}</p>
                          {rule.email_templates ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {rule.email_templates.name}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Nenhum template vinculado
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm('Excluir esta regra?')) {
                              deleteMutation.mutate(rule.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra' : 'Nova Regra de Notificação'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria do Ticket</Label>
                <Select
                  value={formData.ticket_category}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, ticket_category: v }))}
                  disabled={!!editingRule}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Evento</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, event_type: v }))}
                  disabled={!!editingRule}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(evt => (
                      <SelectItem key={evt.value} value={evt.value}>
                        {evt.icon} {evt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template de Email</Label>
              <Select
                value={formData.email_template_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, email_template_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum (não enviar email)</SelectItem>
                  {emailTemplates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Configure templates em Email → Templates
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Regra ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
