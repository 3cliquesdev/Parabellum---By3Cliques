import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TicketSettings, FormField, DEFAULT_TICKET_SETTINGS } from "@/hooks/useForms";
import { Ticket, Mail, AlertTriangle } from "lucide-react";

interface TicketFieldMappingProps {
  fields: FormField[];
  ticketSettings: TicketSettings;
  onChange: (settings: TicketSettings) => void;
  onFieldUpdate: (fieldId: string, ticketField: "subject" | "description" | "priority" | undefined) => void;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const CATEGORY_OPTIONS = [
  { value: "financeiro", label: "Financeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "bug", label: "Bug/Problema" },
  { value: "outro", label: "Outro" },
];

export function TicketFieldMapping({
  fields,
  ticketSettings,
  onChange,
  onFieldUpdate,
}: TicketFieldMappingProps) {
  const settings = { ...DEFAULT_TICKET_SETTINGS, ...ticketSettings };

  const textFields = fields.filter(f => 
    f.type === "text" || f.type === "long_text" || f.type === "select"
  );

  const subjectField = fields.find(f => f.ticket_field === "subject");
  const descriptionField = fields.find(f => f.ticket_field === "description");
  const priorityField = fields.find(f => f.ticket_field === "priority");

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Ticket className="h-4 w-4 text-orange-500" />
          Configurações de Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Field Mapping */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Mapeamento de Campos
          </div>

          {/* Subject Mapping */}
          <div className="space-y-2">
            <Label className="text-sm">Campo → Assunto do Ticket</Label>
            <Select
              value={subjectField?.id || "auto"}
              onValueChange={(v) => {
                // Clear previous mapping
                fields.forEach(f => {
                  if (f.ticket_field === "subject") {
                    onFieldUpdate(f.id, undefined);
                  }
                });
                if (v !== "auto") {
                  onFieldUpdate(v, "subject");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Usar título do formulário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (título do formulário)</SelectItem>
                {textFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description Mapping */}
          <div className="space-y-2">
            <Label className="text-sm">Campo → Descrição do Ticket</Label>
            <Select
              value={descriptionField?.id || "auto"}
              onValueChange={(v) => {
                fields.forEach(f => {
                  if (f.ticket_field === "description") {
                    onFieldUpdate(f.id, undefined);
                  }
                });
                if (v !== "auto") {
                  onFieldUpdate(v, "description");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Concatenar todas respostas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (todas respostas)</SelectItem>
                {textFields.filter(f => f.type === "long_text").map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Default Priority */}
        <div className="space-y-2">
          <Label className="text-sm">Prioridade Padrão</Label>
          <Select
            value={settings.default_priority}
            onValueChange={(v) => onChange({ ...settings, default_priority: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default Category */}
        <div className="space-y-2">
          <Label className="text-sm">Categoria Padrão</Label>
          <Select
            value={settings.default_category}
            onValueChange={(v) => onChange({ ...settings, default_category: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Auto Reply */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Resposta Automática</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar e-mail confirmando recebimento
                </p>
              </div>
            </div>
            <Switch
              checked={settings.send_auto_reply}
              onCheckedChange={(v) => onChange({ ...settings, send_auto_reply: v })}
            />
          </div>

          {settings.send_auto_reply && (
            <div className="space-y-2">
              <Label className="text-sm">Mensagem de Confirmação</Label>
              <Textarea
                value={settings.auto_reply_template}
                onChange={(e) => onChange({ ...settings, auto_reply_template: e.target.value })}
                placeholder="Recebemos sua solicitação..."
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{{ticket_number}}"}, {"{{customer_name}}"}, {"{{subject}}"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
