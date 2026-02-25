import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, MessageSquare, Search, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AIMessageTemplate {
  id: string;
  key: string;
  title: string;
  content: string;
  category: string;
  description: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'financeiro', label: 'Financeiro', color: 'bg-emerald-500' },
  { value: 'verificacao', label: 'Verificação', color: 'bg-blue-500' },
  { value: 'saudacao', label: 'Saudação', color: 'bg-purple-500' },
  { value: 'suporte', label: 'Suporte', color: 'bg-orange-500' },
  { value: 'ticket_cliente', label: 'Ticket (Cliente)', color: 'bg-cyan-500' },
  { value: 'geral', label: 'Geral', color: 'bg-muted-foreground' },
];

export default function AIMessagesSettings() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AIMessageTemplate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    key: '',
    title: '',
    content: '',
    category: 'geral',
    description: '',
    variables: [] as string[],
    is_active: true,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['ai-message-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_message_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('title', { ascending: true });
      
      if (error) throw error;
      return data as AIMessageTemplate[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('ai_message_templates')
        .insert({
          key: data.key,
          title: data.title,
          content: data.content,
          category: data.category,
          description: data.description || null,
          variables: data.variables,
          is_active: data.is_active,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-message-templates'] });
      toast.success('Template criado com sucesso');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar template');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('ai_message_templates')
        .update({
          title: data.title,
          content: data.content,
          category: data.category,
          description: data.description || null,
          variables: data.variables,
          is_active: data.is_active,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-message-templates'] });
      toast.success('Template atualizado com sucesso');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar template');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_message_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-message-templates'] });
      toast.success('Template excluído');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir template');
    }
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      key: '',
      title: '',
      content: '',
      category: 'geral',
      description: '',
      variables: [],
      is_active: true,
    });
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({
      key: '',
      title: '',
      content: '',
      category: 'geral',
      description: '',
      variables: [],
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: AIMessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      key: template.key,
      title: template.title,
      content: template.content,
      category: template.category,
      description: template.description || '',
      variables: template.variables || [],
      is_active: template.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content || !formData.key) {
      toast.error('Preencha título, chave e conteúdo');
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Extrair variáveis do conteúdo automaticamente
  const extractVariables = (content: string) => {
    const matches = content.match(/\{\{(\w+)\}\}/g) || [];
    const vars = matches.map(m => m.replace(/\{\{|\}\}/g, ''));
    return [...new Set(vars)];
  };

  const handleContentChange = (content: string) => {
    const vars = extractVariables(content);
    setFormData(prev => ({ ...prev, content, variables: vars }));
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = search === '' || 
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.key.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[4];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mensagens da IA</h1>
          <p className="text-muted-foreground">
            Personalize as mensagens padrão enviadas pela IA
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Mensagem
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mensagens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-3/4 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {search || selectedCategory !== 'all' 
              ? 'Nenhuma mensagem encontrada com esses filtros' 
              : 'Nenhuma mensagem cadastrada'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map(template => {
            const catInfo = getCategoryInfo(template.category);
            return (
              <Card key={template.id} className={`relative ${!template.is_active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${catInfo.color} text-white`}>
                        {catInfo.label}
                      </Badge>
                      {!template.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm('Excluir esta mensagem?')) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base">{template.title}</CardTitle>
                  <CardDescription className="text-xs font-mono text-muted-foreground">
                    {template.key}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {template.content}
                  </p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map(v => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Mensagem' : 'Nova Mensagem'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">
                  Chave (identificador único)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 ml-1 inline text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Usada no código para identificar a mensagem</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                  placeholder="saque_coleta_dados"
                  disabled={!!editingTemplate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Coleta de Dados para Saque"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (quando usar)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mensagem enviada após cliente confirmar dados..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">Conteúdo da Mensagem</Label>
                <span className="text-xs text-muted-foreground">
                  Use {"{{variavel}}"} para dados dinâmicos
                </span>
              </div>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Olá {{contact_name}}! Como posso ajudar?"
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {formData.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Variáveis detectadas</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.variables.map(v => (
                    <Badge key={v} variant="secondary">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Mensagem ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
