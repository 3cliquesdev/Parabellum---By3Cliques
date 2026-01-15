import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, Trash2, Copy, Ticket, Sparkles, Download } from "lucide-react";
import { useForms, useDeleteForm, useUpdateForm, Form } from "@/hooks/useForms";
import FormDialog from "@/components/FormDialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { usePublicTicketPortalConfig, useTogglePortal } from "@/hooks/usePublicTicketPortal";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function Forms() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = searchParams.get("filter") || "all";
  const { data: forms, isLoading } = useForms();
  const deleteForm = useDeleteForm();
  const updateForm = useUpdateForm();
  const { toast } = useToast();
  const { data: portalConfig, isLoading: portalLoading } = usePublicTicketPortalConfig();
  const togglePortal = useTogglePortal();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", value);
    navigate(`/forms?${params.toString()}`);
  };

  const filteredForms = useMemo(() => {
    if (!forms) return [];
    
    switch (filter) {
      case "active":
        return forms.filter(f => f.is_active);
      case "inactive":
        return forms.filter(f => !f.is_active);
      default:
        return forms;
    }
  }, [forms, filter]);

  const copyFormLink = (formId: string) => {
    const url = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "Link do formulário copiado para a área de transferência.",
    });
  };

  const toggleActive = async (formId: string, isActive: boolean) => {
    await updateForm.mutateAsync({
      id: formId,
      updates: { is_active: !isActive },
    });
  };

  const copyPortalLink = () => {
    const url = `${window.location.origin}/open-ticket`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "Link do portal público copiado para a área de transferência.",
    });
  };

  const exportFormSubmissions = async (form: Form) => {
    try {
      const { data: submissions, error } = await supabase
        .from("form_submissions")
        .select(`
          id,
          answers,
          created_at,
          contact:contacts(first_name, last_name, email, phone)
        `)
        .eq("form_id", form.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!submissions?.length) {
        toast({
          title: "Sem dados",
          description: "Este formulário ainda não tem submissões.",
          variant: "destructive",
        });
        return;
      }

      // Create headers (fixed columns + form fields)
      const fixedHeaders = ["Data", "Nome", "Email", "Telefone"];
      const fieldHeaders = form.schema.fields.map((f) => f.label);
      const headers = [...fixedHeaders, ...fieldHeaders];

      // Create data rows
      const rows = submissions.map((sub) => {
        const contact = sub.contact as { first_name?: string; last_name?: string; email?: string; phone?: string } | null;
        const dateFormatted = format(new Date(sub.created_at), "dd/MM/yyyy HH:mm");
        const name = contact
          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
          : "-";
        const email = contact?.email || "-";
        const phone = contact?.phone || "-";

        // Map answers to fields
        const answers = form.schema.fields.map((field) => {
          const value = (sub.answers as Record<string, any>)?.[field.id];
          if (Array.isArray(value)) {
            return value.map((v) => (typeof v === "object" && v?.name ? v.name : v)).join(", ");
          }
          return value || "-";
        });

        return [dateFormatted, name, email, phone, ...answers];
      });

      // Generate CSV with BOM for Excel compatibility
      const csv = [
        headers.join(";"),
        ...rows.map((r) =>
          r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")
        ),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${form.name}-respostas-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast({
        title: "Exportado com sucesso!",
        description: `${submissions.length} respostas exportadas.`,
      });
    } catch (error) {
      console.error("Error exporting submissions:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar as respostas.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || portalLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Formulários</h2>
            <p className="text-muted-foreground">Crie formulários para captar leads</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/forms/builder")}>
              <Sparkles className="h-4 w-4" />
              Builder 2.0
            </Button>
            <FormDialog
              trigger={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Formulário
                </Button>
              }
            />
          </div>
        </div>
        
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="inactive">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Portal Público de Tickets - Always visible */}
      {portalConfig && (
        <Card className="border-primary/50 bg-primary/5 mb-6">
          <CardHeader>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3 flex-1">
                <Ticket className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-lg">{portalConfig.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {portalConfig.description}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  PÚBLICO
                </Badge>
                <Switch
                  checked={portalConfig.is_active}
                  onCheckedChange={() => togglePortal.mutate(portalConfig.is_active)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={copyPortalLink}
              >
                <Copy className="h-4 w-4" />
                Copiar Link
              </Button>
              <Button
                variant="outline"
                asChild
              >
                <a href="/open-ticket" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!filteredForms || filteredForms.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Nenhum formulário criado ainda. Clique em "Novo Formulário" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredForms.map((form) => (
            <Card key={form.id}>
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{form.name}</CardTitle>
                    {form.description && (
                      <CardDescription className="mt-1">{form.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={() => toggleActive(form.id, form.is_active)}
                    />
                  </div>
                </div>
                <Badge variant={form.is_active ? "default" : "secondary"}>
                  {form.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Campos:</span>
                    <span className="font-semibold text-foreground">
                      {form.schema.fields.length}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => copyFormLink(form.id)}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`/f/${form.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/forms/builder/${form.id}`)}
                      title="Editar no Builder 2.0"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportFormSubmissions(form)}
                      title="Baixar respostas (CSV)"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o formulário "{form.name}"?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteForm.mutate(form.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
