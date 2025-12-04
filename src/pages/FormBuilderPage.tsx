import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FormBuilderV2 } from "@/components/forms/FormBuilderV2";
import { FormPreviewModal } from "@/components/forms/FormPreviewModal";
import { FormRoutingConfig, FormRoutingSettings } from "@/components/forms/FormRoutingConfig";
import { FormShareDialog } from "@/components/forms/FormShareDialog";
import { TicketFieldMapping } from "@/components/forms/TicketFieldMapping";
import { useFormById, useCreateForm, useUpdateForm, FormSchema, DEFAULT_FORM_SETTINGS, DEFAULT_TICKET_SETTINGS, FormTargetType, FormDistributionRule, TicketSettings } from "@/hooks/useForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Eye, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: existingForm, isLoading } = useFormById(formId);
  const createForm = useCreateForm();
  const updateForm = useUpdateForm();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schema, setSchema] = useState<FormSchema>({
    fields: [],
    settings: DEFAULT_FORM_SETTINGS,
    ticket_settings: DEFAULT_TICKET_SETTINGS,
  });
  const [routingSettings, setRoutingSettings] = useState<FormRoutingSettings>({
    target_type: "deal",
    distribution_rule: "round_robin",
    notify_manager: true,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!formId;

  // Load existing form data
  useEffect(() => {
    if (existingForm) {
      setName(existingForm.name);
      setDescription(existingForm.description || "");
      setSchema({
        ...existingForm.schema,
        ticket_settings: existingForm.schema.ticket_settings || DEFAULT_TICKET_SETTINGS,
      });
      setRoutingSettings({
        target_type: existingForm.target_type || "deal",
        target_department_id: existingForm.target_department_id || undefined,
        target_pipeline_id: existingForm.target_pipeline_id || undefined,
        target_user_id: existingForm.target_user_id || undefined,
        distribution_rule: existingForm.distribution_rule || "round_robin",
        notify_manager: existingForm.notify_manager ?? true,
      });
    }
  }, [existingForm]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe um nome para o formulário.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const formData = {
        name,
        description,
        schema,
        target_type: routingSettings.target_type,
        target_department_id: routingSettings.target_department_id || null,
        target_pipeline_id: routingSettings.target_pipeline_id || null,
        target_user_id: routingSettings.target_user_id || null,
        distribution_rule: routingSettings.distribution_rule,
        notify_manager: routingSettings.notify_manager,
      };

      if (isEditing) {
        await updateForm.mutateAsync({
          id: formId!,
          updates: formData,
        });
      } else {
        const result = await createForm.mutateAsync(formData);
        navigate(`/forms/builder/${result.id}`, { replace: true });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTicketSettingsChange = (ticketSettings: TicketSettings) => {
    setSchema({ ...schema, ticket_settings: ticketSettings });
  };

  const handleFieldTicketMappingUpdate = (fieldId: string, ticketField: "subject" | "description" | "priority" | undefined) => {
    const newFields = schema.fields.map(f => 
      f.id === fieldId ? { ...f, ticket_field: ticketField } : f
    );
    setSchema({ ...schema, fields: newFields });
  };

  if (isLoading && isEditing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isTicketMode = routingSettings.target_type === "ticket";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/forms")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">
                  {isEditing ? "Editar Formulário" : "Novo Formulário"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isTicketMode ? "Web-to-Ticket" : "Construtor Visual 2.0"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditing && (
                <FormShareDialog
                  formId={formId!}
                  formName={name}
                  trigger={
                    <Button variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Compartilhar
                    </Button>
                  }
                />
              )}
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Left Column: Form Info + Routing + Ticket Config */}
          <div className="lg:col-span-1 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)] pr-2 scrollbar-thin">
            {/* Form Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Formulário de Suporte"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição interna..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Routing Config */}
            <FormRoutingConfig
              settings={routingSettings}
              onChange={setRoutingSettings}
            />

            {/* Ticket Field Mapping (only for ticket type) */}
            {isTicketMode && (
              <TicketFieldMapping
                fields={schema.fields}
                ticketSettings={schema.ticket_settings || DEFAULT_TICKET_SETTINGS}
                onChange={handleTicketSettingsChange}
                onFieldUpdate={handleFieldTicketMappingUpdate}
              />
            )}
          </div>

          {/* Right Column: Form Builder */}
          <div className="lg:col-span-3 overflow-y-auto max-h-[calc(100vh-120px)]">
            <FormBuilderV2
              schema={schema}
              onChange={setSchema}
              onPreview={() => setShowPreview(true)}
            />
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      <FormPreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        schema={schema}
      />
    </div>
  );
}
