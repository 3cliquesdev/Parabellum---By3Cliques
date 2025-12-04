import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FormBuilderV2 } from "@/components/forms/FormBuilderV2";
import { FormPreviewModal } from "@/components/forms/FormPreviewModal";
import { useFormById, useCreateForm, useUpdateForm, FormSchema, DEFAULT_FORM_SETTINGS } from "@/hooks/useForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Eye, Link2, Copy, Check } from "lucide-react";
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
  });
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!formId;

  // Load existing form data
  useEffect(() => {
    if (existingForm) {
      setName(existingForm.name);
      setDescription(existingForm.description || "");
      setSchema(existingForm.schema);
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
      if (isEditing) {
        await updateForm.mutateAsync({
          id: formId!,
          updates: { name, description, schema },
        });
      } else {
        const result = await createForm.mutateAsync({ name, description, schema });
        // Navigate to edit mode after creation
        navigate(`/forms/builder/${result.id}`, { replace: true });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!formId) return;
    const url = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copiado!",
      description: "O link do formulário foi copiado para a área de transferência.",
    });
  };

  if (isLoading && isEditing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                  Construtor Visual 2.0
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditing && (
                <Button variant="outline" onClick={handleCopyLink}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  {copied ? "Copiado!" : "Copiar Link"}
                </Button>
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
      <main className="container mx-auto px-4 py-6">
        {/* Form Info */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informações do Formulário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Formulário *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Formulário de Interesse"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição interna..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Builder */}
        <FormBuilderV2
          schema={schema}
          onChange={setSchema}
          onPreview={() => setShowPreview(true)}
        />
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
