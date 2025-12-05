import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { EmailBuilderV2 } from "@/components/email/EmailBuilderV2";
import { useEmailTemplate, useCreateEmailTemplate, useUpdateEmailTemplate } from "@/hooks/useEmailTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TRIGGER_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "deal_created", label: "Negócio Criado" },
  { value: "deal_won", label: "Negócio Ganho" },
  { value: "deal_lost", label: "Negócio Perdido" },
  { value: "contact_created", label: "Contato Criado" },
  { value: "ticket_created", label: "Ticket Criado" },
  { value: "ticket_resolved", label: "Ticket Resolvido" },
  { value: "playbook_step", label: "Etapa de Playbook" },
];

export default function EmailBuilderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: existingTemplate, isLoading } = useEmailTemplate(templateId);
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!templateId;

  // Load existing template data
  useEffect(() => {
    if (existingTemplate) {
      setName(existingTemplate.name);
      setSubject(existingTemplate.subject);
      setTriggerType(existingTemplate.trigger_type || "manual");
    }
  }, [existingTemplate]);

  const handleSave = async (data: { html: string; design: any }) => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe um nome para o template.",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Assunto obrigatório",
        description: "Por favor, informe o assunto do e-mail.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing) {
        await updateTemplate.mutateAsync({
          id: templateId!,
          updates: {
            name,
            subject,
            html_body: data.html,
            design_json: data.design,
            trigger_type: triggerType,
          },
        });
      } else {
        const result = await createTemplate.mutateAsync({
          name,
          subject,
          html_body: data.html,
          design_json: data.design,
          trigger_type: triggerType,
        });
        // Navigate to edit mode after creation
        navigate(`/email-templates/builder/${result.id}`, { replace: true });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && isEditing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/email-templates")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">
                  {isEditing ? "Editar Template" : "Novo Template de E-mail"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Editor Visual Drag-and-Drop
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Form Info */}
      <div className="container mx-auto px-4 py-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informações do Template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Boas-vindas ao Cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Assunto do E-mail *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Bem-vindo, {{nome}}!"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Gatilho</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Builder */}
      <div className="flex-1 container mx-auto px-4 pb-4">
        <Card className="h-[calc(100vh-280px)] overflow-hidden">
          {/* Só renderiza o editor quando os dados estiverem prontos (evita race condition) */}
          {(!isEditing || existingTemplate) ? (
            <EmailBuilderV2
              initialDesign={existingTemplate?.design_json}
              initialHtml={existingTemplate?.html_body}
              onSave={handleSave}
              isSaving={isSaving}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
