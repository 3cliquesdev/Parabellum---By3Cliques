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
  Mail,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Sparkles,
} from "lucide-react";
import { EmailTemplateDialog } from "@/components/EmailTemplateDialog";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useDeleteEmailTemplate } from "@/hooks/useDeleteEmailTemplate";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";
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

export default function EmailTemplates() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const { data: templates, isLoading } = useEmailTemplates();
  const deleteMutation = useDeleteEmailTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Tables<"email_templates"> | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Tables<"email_templates"> | null>(null);

  // Verificar permissão de acesso
  if (!roleLoading && role !== null && role !== 'admin' && role !== 'manager') {
    navigate('/dashboard');
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
      deal_created: "Negócio Criado",
      deal_won: "Negócio Ganho",
      deal_lost: "Negócio Perdido",
      contact_created: "Contato Criado",
      contact_inactive: "Contato Inativo",
    };
    return trigger ? labels[trigger] || trigger : "—";
  };

  if (isLoading || roleLoading) {
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
      <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">Templates de Email</h1>
          <p className="text-lg text-muted-foreground">
            Crie e gerencie templates reutilizáveis para suas automações
          </p>
        </div>
        <Button onClick={handleNewTemplate} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Novo Template
        </Button>
      </div>

      {/* Empty State */}
      {!templates || templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-6 mb-6">
              <Mail className="h-16 w-16 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Nenhum template ainda</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Templates de email permitem que você envie mensagens personalizadas automaticamente baseadas em eventos do CRM
            </p>
            <Button onClick={handleNewTemplate} size="lg" className="gap-2">
              <Sparkles className="h-5 w-5" />
              Criar Primeiro Template
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
                  <Badge variant="outline" className="text-xs">
                    {getTriggerLabel(template.trigger_type)}
                  </Badge>
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
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(template)}
                    className="flex-1 gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Visualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(template)}
                    className="flex-1 gap-2 hover:bg-yellow-500/10 hover:text-yellow-500 hover:border-yellow-500/50"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(template.id)}
                    className="gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>

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
          <div className="border rounded-lg p-4 bg-background max-h-96 overflow-y-auto">
            <div dangerouslySetInnerHTML={{ __html: previewTemplate?.html_body || "" }} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
