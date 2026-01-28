import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCreateRoutingRule } from "@/hooks/useCreateRoutingRule";
import { useUpdateRoutingRule } from "@/hooks/useUpdateRoutingRule";
import { usePersonas } from "@/hooks/usePersonas";
import { useDepartments } from "@/hooks/useDepartments";

interface RoutingRuleDialogProps {
  trigger: React.ReactNode;
  rule?: {
    id: string;
    channel: string;
    department: string | null;
    persona_id: string | null;
    priority: number | null;
    is_active: boolean | null;
  };
  onOpenChange?: (open: boolean) => void;
}

export function RoutingRuleDialog({ trigger, rule, onOpenChange }: RoutingRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string>("whatsapp");
  const [department, setDepartment] = useState<string | undefined>(undefined);
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const { data: personas } = usePersonas();
  const { data: departments } = useDepartments();
  const createRule = useCreateRoutingRule();
  const updateRule = useUpdateRoutingRule();

  useEffect(() => {
    if (rule) {
      setChannel(rule.channel);
      setDepartment(rule.department || undefined);
      setPersonaId(rule.persona_id || undefined);
      setPriority(rule.priority ?? 0);
      setIsActive(rule.is_active ?? true);
    } else {
      setChannel("whatsapp");
      setDepartment(undefined);
      setPersonaId(undefined);
      setPriority(0);
      setIsActive(true);
    }
  }, [rule, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!personaId) {
      return;
    }

    const data = {
      channel,
      department: department || null,
      persona_id: personaId,
      priority,
      is_active: isActive,
    };

    if (rule) {
      await updateRule.mutateAsync({ id: rule.id, data });
    } else {
      await createRule.mutateAsync(data);
    }

    setOpen(false);
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      onOpenChange?.(isOpen);
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar Regra de Roteamento" : "Nova Regra de Roteamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel">Canal</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="web_chat">Chat</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Canal de comunicação para esta regra
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Departamento (Opcional)</Label>
            <Select value={department || "none"} onValueChange={(val) => setDepartment(val === "none" ? undefined : val)}>
              <SelectTrigger id="department">
                <SelectValue placeholder="Qualquer departamento" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                <SelectItem value="none">Qualquer departamento</SelectItem>
                {departments?.filter(d => d.is_active).map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se vazio, a regra se aplica a qualquer departamento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="persona">Persona</Label>
            <Select value={personaId || undefined} onValueChange={setPersonaId} required>
              <SelectTrigger id="persona">
                <SelectValue placeholder="Selecione uma persona" />
              </SelectTrigger>
              <SelectContent>
                {personas?.filter(p => p.is_active).map((persona) => (
                  <SelectItem key={persona.id} value={persona.id}>
                    {persona.name} - {persona.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Persona que responderá neste canal/departamento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Input
              id="priority"
              type="number"
              min="0"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Maior prioridade = regra aplicada primeiro (use quando há múltiplas regras para o mesmo canal)
            </p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="isActive">Regra Ativa</Label>
              <p className="text-sm text-muted-foreground">Ativar roteamento</p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>
              {rule ? "Salvar Alterações" : "Criar Regra"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
