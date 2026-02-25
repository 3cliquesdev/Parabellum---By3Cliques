import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Sparkles,
  Layers,
  Copy,
} from "lucide-react";
import { EmailTemplateDialog } from "@/components/EmailTemplateDialog";
import { useEmailTemplates, useDuplicateEmailTemplate } from "@/hooks/useEmailTemplates";
import { useDeleteEmailTemplate } from "@/hooks/useDeleteEmailTemplate";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import type { Tables } from "@/integrations/supabase/types";
import { SafeHTML } from "@/components/SafeHTML";
import { MigrateTemplateButton } from "@/components/email-builder-v2/MigrateTemplateButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmailTemplatesV2List, CreateTemplateV2Dialog } from "@/components/email-builder-v2";

export default function EmailTemplates() {
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const { data: templates, isLoading } = useEmailTemplates();
  const deleteMutation = useDeleteEmailTemplate();
  const duplicateMutation = useDuplicateEmailTemplate();

  const [activeTab, setActiveTab] = useState("v2");
  const [createV2DialogOpen, setCreateV2DialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Tables<"email_templates"> | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Tables<"email_templates"> | null>(null);

  // Verificar permissão de acesso
  if (!permLoading && !hasPermission("email.view_templates")) {
    navigate('/');
    return null;
  }

  const handleEdit = (template: Tables<"email_templates">) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      await deleteMutation.mutateAsync(templateToDelete);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handlePreview = (template: Tables<"email_templates">) => {
    setPreviewTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(undefined);
    setDialogOpen(true);
  };

  const getTriggerLabel = (trigger: string | null) => {
    const labels: Record<string, string> = {
      // CRM triggers
      deal_created: "Negócio Criado",
      deal_won: "Negócio Ganho",
      deal_lost: "Negócio Perdido",
      contact_created: "Contato Criado",
      contact_inactive: "Contato Inativo",
      // Kiwify triggers
      order_paid: "🛒 Compra Aprovada",
      subscription_renewed: "🔄 Assinatura Renovada",
      cart_abandoned: "🛒 Carrinho Abandonado",
      payment_refused: "❌ Cartão Recusado",
      subscription_card_declined: "💳 Cartão Assinatura Recusado",
      subscription_late: "⏰ Assinatura em Atraso",
      upsell_paid: "💰 Upsell Aprovado",
      refunded: "↩️ Reembolso",
      churned: "🚪 Churn/Cancelamento",
    };
    return trigger ? labels[trigger] || trigger : "—";
  };

  if (isLoading || permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando templates...</p>
      </div>
    );
  }

  const getHtmlPreview = (html: string) => {
    const text = html.replace(/<[^>]*>/g, '');
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  };

  return (
    <>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Templates de Email</h1>
            <p className="text-lg text-muted-foreground">
              Crie e gerencie templates reutilizáveis para suas automações
            </p>
          </div>
        </div>

        {/* Tabs V1/V2 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="v2" className="gap-2">
              <Layers className="h-4 w-4" />
              Editor V2 (Novo)
            </TabsTrigger>
            <TabsTrigger value="v1" className="gap-2">
              <Mail className="h-4 w-4" />
              Editor V1 (Legado)
            </TabsTrigger>
          </TabsList>

          {/* V2 Content */}
          <TabsContent value="v2" className="mt-6">
            <EmailTemplatesV2List onCreateNew={() => setCreateV2DialogOpen(true)} />
          </TabsContent>

          {/* V1 Content */}
          <TabsContent value="v1" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button onClick={handleNewTemplate} className="gap-2">
                <Plus className="h-5 w-5" />
                Novo Template V1
              </Button>
            </div>

      {/* Empty State */}
      {!templates || templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-6 mb-6">
              <Mail className="h-16 w-16 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Nenhum template V1</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Templates legados. Recomendamos usar o Editor V2 para novos templates.
            </p>
            <Button onClick={handleNewTemplate} size="lg" className="gap-2">
              <Sparkles className="h-5 w-5" />
              Criar Template V1
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-all duration-200 overflow-hidden">
              <CardHeader className="pb-4">
                {/* Status Badge */}
                <div className="flex items-start justify-between mb-3">
                  <Badge 
                    variant={template.is_active ? "default" : "secondary"}
                    className={template.is_active ? "bg-green-500/20 text-green-400 border-green-500/50" : ""}
                  >
                    {template.is_active ? "● Ativo" : "○ Inativo"}
                  </Badge>
                  {((template as any).trigger_types?.length > 0 
                    ? (template as any).trigger_types 
                    : template.trigger_type ? [template.trigger_type] : []
                  ).map((t: string) => (
                    <Badge key={t} variant="outline" className="text-xs">
                      {getTriggerLabel(t)}
                    </Badge>
                  ))}
                  {!((template as any).trigger_types?.length > 0 || template.trigger_type) && (
                    <Badge variant="outline" className="text-xs">
                      {getTriggerLabel(null)}
                    </Badge>
                  )}
                </div>

                {/* Title and Subject */}
                <CardTitle className="text-xl mb-2">{template.name}</CardTitle>
                <CardDescription className="text-base">
                  <span className="font-medium text-foreground">Assunto:</span> {template.subject}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* HTML Preview */}
                <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Preview:</p>
                  <p className="text-sm text-foreground/80 line-clamp-3">
                    {getHtmlPreview(template.html_body)}
                  </p>
                </div>

                {/* Variables */}
                {template.variables && Array.isArray(template.variables) && template.variables.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Variáveis disponíveis:</p>
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-1.5">
                        {template.variables.slice(0, 4).map((variable: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs font-mono">
                            {variable}
                          </Badge>
                        ))}
                        {template.variables.length > 4 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                +{template.variables.length - 4} mais
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                {template.variables.slice(4).map((variable: string, idx: number) => (
                                  <div key={idx} className="text-xs font-mono">{variable}</div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(template)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/email-templates/builder/${template.id}`)}
                    className="gap-2"
                    title="Editor Visual Drag & Drop"
                  >
                    <Sparkles className="h-4 w-4" />
                    Editor
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(template)}
                    className="gap-2 hover:bg-accent hover:text-accent-foreground"
                    title="Editar metadados"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => duplicateMutation.mutate(template.id)}
                    disabled={duplicateMutation.isPending}
                    className="gap-2"
                    title="Duplicar template"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(template.id)}
                    className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Migration Button */}
                <div className="pt-2 border-t">
                  <MigrateTemplateButton 
                    template={template} 
                    onMigrated={() => setActiveTab("v2")} 
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateTemplateV2Dialog
        open={createV2DialogOpen}
        onOpenChange={setCreateV2DialogOpen}
      />

      <EmailTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={selectedTemplate}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Preview: {previewTemplate?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Assunto: {previewTemplate?.subject}
            </AlertDialogDescription>
          </AlertDialogHeader>
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-white">
                <style>{`
                  .email-preview,
                  .email-preview * { 
                    color: #1a1a1a !important; 
                    background-color: transparent !important;
                  }
                  .email-preview { 
                    background-color: white !important;
                  }
                `}</style>
                <SafeHTML 
                  html={previewTemplate?.html_body || ""} 
                  className="email-preview prose prose-sm max-w-none"
                />
              </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
