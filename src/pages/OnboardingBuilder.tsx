import { useState, Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Workflow, Edit, Trash2, Copy, BarChart3, Sparkles, Package, Link2, ExternalLink, Phone, Rocket } from "lucide-react";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { useCreatePlaybook } from "@/hooks/useCreatePlaybook";
import { getOnboardingCompletoTemplate, ONBOARDING_COMPLETO_META } from "@/lib/playbook-templates";
import { useUpdatePlaybook } from "@/hooks/useUpdatePlaybook";
import { useDeletePlaybook } from "@/hooks/useDeletePlaybook";
import { useProducts } from "@/hooks/useProducts";
import { usePlaybookProducts } from "@/hooks/usePlaybookProducts";
import { Switch } from "@/components/ui/switch";
import { PlaybookProductsTab } from "@/components/playbook/PlaybookProductsTab";
import { useToast } from "@/hooks/use-toast";

// Lazy load do editor para não bloquear o carregamento da página
const PlaybookEditor = lazy(() => import("@/components/playbook/PlaybookEditor"));

export default function OnboardingBuilder() {
  const { data: playbooks, isLoading } = usePlaybooks();
  const { data: products } = useProducts();
  const createPlaybook = useCreatePlaybook();
  const updatePlaybook = useUpdatePlaybook();
  const deletePlaybook = useDeletePlaybook();
  const { toast } = useToast();

  const copyPublicLink = (playbookId: string) => {
    const url = `${window.location.origin}/public-onboarding/playbook/${playbookId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "Link do onboarding guiado copiado para a área de transferência.",
    });
  };

  const [showEditor, setShowEditor] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState<string>();
  const [supportPhone, setSupportPhone] = useState("5511999999999");
  const [flowDefinition, setFlowDefinition] = useState<any>(null);

  const handleCreateFromTemplate = (template: any) => {
    setName(`Cópia: ${template.name}`);
    setDescription(template.description);
    setFlowDefinition(template.flow_definition);
    setShowCreateDialog(true);
  };

  const handleEdit = (playbook: any) => {
    setEditingPlaybook(playbook);
    setName(playbook.name);
    setDescription(playbook.description || "");
    setProductId(playbook.product_id);
    setSupportPhone(playbook.support_phone || "5511999999999");
    setFlowDefinition(playbook.flow_definition);
    setShowEditor(true);
  };

  const handleSaveFlow = (flow: any) => {
    setIsSaving(true);

    const onSuccess = () => {
      setIsSaving(false);
      setShowEditor(false);
      setShowCreateDialog(false);
      setIsCreatingTemplate(false);
      resetForm();
    };

    const onError = () => {
      setIsSaving(false);
    };

    // Determina se deve salvar como template
    const shouldBeTemplate = isCreatingTemplate || editingPlaybook?.is_template;

    if (editingPlaybook) {
      updatePlaybook.mutate(
        {
          id: editingPlaybook.id,
          name,
          description,
          product_id: productId,
          support_phone: supportPhone,
          flow_definition: flow,
        },
        { onSuccess, onError }
      );
    } else {
      createPlaybook.mutate(
        {
          name,
          description,
          product_id: productId,
          support_phone: supportPhone,
          flow_definition: flow,
          is_template: shouldBeTemplate,
        },
        { onSuccess, onError }
      );
    }
  };

  const handleCreateNew = () => {
    setIsCreatingTemplate(false);
    setShowCreateDialog(true);
  };

  const handleCreateNewTemplate = () => {
    setIsCreatingTemplate(true);
    setShowCreateDialog(true);
  };

  const handleStartEditor = () => {
    setShowCreateDialog(false);
    setShowEditor(true);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setProductId(undefined);
    setSupportPhone("5511999999999");
    setFlowDefinition(null);
    setEditingPlaybook(null);
    setIsCreatingTemplate(false);
  };

  const handleToggleActive = (playbook: any) => {
    updatePlaybook.mutate({
      id: playbook.id,
      is_active: !playbook.is_active,
    });
  };

  const templates = playbooks?.filter((p) => p.is_template) || [];
  const customPlaybooks = playbooks?.filter((p) => !p.is_template) || [];

  // Get linked products count for a playbook
  const { data: linkedProductsForEditing } = usePlaybookProducts(editingPlaybook?.id);

  if (showEditor) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">
            {editingPlaybook ? "Editar Playbook" : "Criar Novo Playbook"}
          </h1>
          <p className="text-muted-foreground">
            {name || "Configure o nome e produto antes de desenhar o fluxo"}
          </p>
        </div>

        {editingPlaybook ? (
          <Tabs defaultValue="editor" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="editor" className="gap-2">
                <Workflow className="h-4 w-4" />
                Editor de Fluxo
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-2">
                <Link2 className="h-4 w-4" />
                Produtos Vinculados
                {linkedProductsForEditing && linkedProductsForEditing.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{linkedProductsForEditing.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor">
              <Suspense fallback={
                <Card className="p-8">
                  <div className="text-center">
                    <Workflow className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                    <p className="text-muted-foreground">Carregando editor visual...</p>
                  </div>
                </Card>
              }>
                <PlaybookEditor
                  initialFlow={flowDefinition}
                  onSave={handleSaveFlow}
                  onCancel={() => {
                    setShowEditor(false);
                    resetForm();
                  }}
                  isSaving={isSaving}
                  playbookId={editingPlaybook?.id}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="products">
              <PlaybookProductsTab
                playbookId={editingPlaybook?.id}
                playbookName={name}
              />
              <div className="mt-4">
                <Button variant="outline" onClick={() => { setShowEditor(false); resetForm(); }}>
                  Voltar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <Suspense fallback={
            <Card className="p-8">
              <div className="text-center">
                <Workflow className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Carregando editor visual...</p>
              </div>
            </Card>
          }>
            <PlaybookEditor
              initialFlow={flowDefinition}
              onSave={handleSaveFlow}
              onCancel={() => {
                setShowEditor(false);
                resetForm();
              }}
              isSaving={isSaving}
              playbookId={editingPlaybook?.id}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
            <Workflow className="h-8 w-8" />
            Playbooks de Onboarding
          </h1>
          <p className="text-muted-foreground mt-1">
            Desenhe fluxos visuais que executam automaticamente quando clientes compram
          </p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Playbook
        </Button>
      </div>

      {/* Biblioteca de Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Biblioteca de Templates
              </CardTitle>
              <CardDescription>
                Comece rápido com templates pré-configurados
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="gap-2"
                onClick={() => {
                  const flow = getOnboardingCompletoTemplate();
                  createPlaybook.mutate(
                    {
                      name: ONBOARDING_COMPLETO_META.name,
                      description: ONBOARDING_COMPLETO_META.description,
                      flow_definition: flow,
                      is_active: false,
                      is_template: true,
                    },
                    {
                      onSuccess: () => {
                        toast({
                          title: "Template criado!",
                          description: "O template 'Onboarding Completo' foi adicionado à biblioteca.",
                        });
                      },
                    }
                  );
                }}
              >
                <Rocket className="h-4 w-4" />
                Criar Template Onboarding
              </Button>
              <Button size="sm" variant="outline" onClick={handleCreateNewTemplate} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum template criado ainda.</p>
              </div>
            ) : (
              templates.map((template) => (
                <Card key={template.id} className="relative">
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit">Template</Badge>
                    <CardTitle className="text-lg mt-2">{template.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(template)}
                        className="flex-1 gap-2"
                      >
                        <Edit className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateFromTemplate(template)}
                        className="flex-1 gap-2"
                      >
                        <Copy className="h-3 w-3" />
                        Usar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Excluir este template?")) {
                            deletePlaybook.mutate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Playbooks Customizados */}
      <Card>
        <CardHeader>
          <CardTitle>Meus Playbooks</CardTitle>
          <CardDescription>
            Playbooks personalizados associados aos seus produtos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : customPlaybooks.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Nenhum playbook customizado ainda. Crie um novo!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customPlaybooks.map((playbook) => (
                <Card key={playbook.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{playbook.name}</CardTitle>
                        {playbook.product && (
                          <Badge variant="outline" className="mt-2">
                            {playbook.product.name}
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={playbook.is_active}
                        onCheckedChange={() => handleToggleActive(playbook)}
                      />
                    </div>
                    <CardDescription className="text-xs mt-2">
                      {playbook.description || "Sem descrição"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <BarChart3 className="h-4 w-4" />
                      <span>{playbook.execution_count || 0} execuções</span>
                    </div>
                    
                    {/* Botões de Link Público */}
                    <div className="flex gap-1 mb-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyPublicLink(playbook.id)}
                        className="flex-1 gap-1 text-xs"
                      >
                        <Copy className="h-3 w-3" />
                        Copiar Link
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        asChild
                      >
                        <a 
                          href={`/public-onboarding/playbook/${playbook.id}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(playbook)}
                        className="flex-1 gap-2"
                      >
                        <Edit className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Deletar este playbook?")) {
                            deletePlaybook.mutate(playbook.id);
                          }
                        }}
                        className="gap-2"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criação */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Novo Playbook</DialogTitle>
            <DialogDescription>
              Defina as informações básicas antes de desenhar o fluxo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome do Playbook *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Onboarding Premium"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva quando este playbook deve ser usado..."
              />
            </div>
            <div>
              <Label>Produto (Opcional)</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Quando associado a um produto, executa automaticamente quando deal é ganho
              </p>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                WhatsApp de Suporte
              </Label>
              <Input
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="5511999999999"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Número do WhatsApp para o botão de suporte na página pública do playbook
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStartEditor} disabled={!name}>
              Continuar para Editor
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
