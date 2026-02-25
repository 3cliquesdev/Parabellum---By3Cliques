import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useCreateEmailTemplateV2 } from "@/hooks/useEmailBuilderV2";
import { useToast } from "@/hooks/use-toast";

interface CreateTemplateV2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { value: "welcome", label: "Boas-vindas" },
  { value: "transactional", label: "Transacional" },
  { value: "notification", label: "Notificação" },
  { value: "marketing", label: "Marketing" },
  { value: "onboarding", label: "Onboarding" },
  { value: "support", label: "Suporte" },
];

const triggerTypes = [
  { value: "manual", label: "Manual" },
  { value: "deal_created", label: "Negócio Criado" },
  { value: "deal_won", label: "Negócio Ganho" },
  { value: "deal_lost", label: "Negócio Perdido" },
  { value: "ticket_created", label: "Ticket Criado" },
  { value: "ticket_resolved", label: "Ticket Resolvido" },
  { value: "contact_created", label: "Contato Criado" },
  { value: "playbook_step", label: "Etapa de Playbook" },
  { value: "form_submission", label: "Envio de Formulário" },
];

export function CreateTemplateV2Dialog({
  open,
  onOpenChange,
}: CreateTemplateV2DialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createMutation = useCreateEmailTemplateV2();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "transactional",
    trigger_types: [] as string[],
    default_subject: "",
    default_preheader: "",
    is_active: true,
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para o template",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        trigger_type: formData.trigger_types[0] || "manual",
        default_subject: formData.default_subject || null,
        default_preheader: formData.default_preheader || null,
        is_active: formData.is_active,
        ab_testing_enabled: false,
      });

      onOpenChange(false);
      navigate(`/email-templates/v2/builder/${result.id}`);
    } catch (error) {
      // Error handled by hook
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "transactional",
      trigger_types: [],
      default_subject: "",
      default_preheader: "",
      is_active: true,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Template V2</DialogTitle>
          <DialogDescription>
            Crie um novo template de email com o editor visual drag-and-drop
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Template *</Label>
            <Input
              id="name"
              placeholder="Ex: Email de Boas-vindas"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva o propósito deste template..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
            />
          </div>

          {/* Categoria e Trigger */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gatilhos</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-[180px] overflow-y-auto">
                {triggerTypes.map((trigger) => {
                  const isChecked = formData.trigger_types.includes(trigger.value);
                  return (
                    <label
                      key={trigger.value}
                      className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 hover:bg-accent transition-colors text-sm"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ ...formData, trigger_types: [...formData.trigger_types, trigger.value] });
                          } else {
                            setFormData({ ...formData, trigger_types: formData.trigger_types.filter(v => v !== trigger.value) });
                          }
                        }}
                      />
                      <span>{trigger.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Assunto */}
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto Padrão</Label>
            <Input
              id="subject"
              placeholder="Ex: Bem-vindo à {{company.name}}!"
              value={formData.default_subject}
              onChange={(e) =>
                setFormData({ ...formData, default_subject: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{variável}}"} para conteúdo dinâmico
            </p>
          </div>

          {/* Preheader */}
          <div className="space-y-2">
            <Label htmlFor="preheader">Preheader</Label>
            <Input
              id="preheader"
              placeholder="Texto de prévia exibido na caixa de entrada"
              value={formData.default_preheader}
              onChange={(e) =>
                setFormData({ ...formData, default_preheader: e.target.value })
              }
            />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>Template Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Templates inativos não serão disparados automaticamente
              </p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Criando..." : "Criar e Editar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
