import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateDepartment } from "@/hooks/useCreateDepartment";
import { useUpdateDepartment } from "@/hooks/useUpdateDepartment";
import { useTags } from "@/hooks/useTags";
import type { Department } from "@/hooks/useDepartments";

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
}

export default function DepartmentDialog({ open, onOpenChange, department }: DepartmentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  
  // Auto-close settings
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [autoCloseMinutes, setAutoCloseMinutes] = useState<number | "">("");
  const [sendRatingOnClose, setSendRatingOnClose] = useState(true);
  const [aiAutoCloseEnabled, setAiAutoCloseEnabled] = useState(false);
  const [aiAutoCloseMinutes, setAiAutoCloseMinutes] = useState<number | "">("");
  const [humanAutoCloseEnabled, setHumanAutoCloseEnabled] = useState(false);
  const [humanAutoCloseMinutes, setHumanAutoCloseMinutes] = useState<number | "">("");
  const [humanAutoCloseTagId, setHumanAutoCloseTagId] = useState<string>("");
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const { data: tags } = useTags();

  useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description || "");
      setColor(department.color);
      setWhatsappNumber(department.whatsapp_number || "");
      setAutoCloseEnabled(department.auto_close_enabled ?? false);
      setAutoCloseMinutes(department.auto_close_minutes ?? "");
      setSendRatingOnClose(department.send_rating_on_close ?? true);
      setAiAutoCloseEnabled(department.ai_auto_close_minutes != null);
      setAiAutoCloseMinutes(department.ai_auto_close_minutes ?? "");
      setHumanAutoCloseEnabled(department.human_auto_close_minutes != null);
      setHumanAutoCloseMinutes(department.human_auto_close_minutes ?? "");
      setHumanAutoCloseTagId(department.human_auto_close_tag_id ?? "");
    } else {
      setName("");
      setDescription("");
      setColor("#3B82F6");
      setWhatsappNumber("");
      setAutoCloseEnabled(false);
      setAutoCloseMinutes("");
      setSendRatingOnClose(true);
      setAiAutoCloseEnabled(false);
      setAiAutoCloseMinutes("");
      setHumanAutoCloseEnabled(false);
      setHumanAutoCloseMinutes("");
      setHumanAutoCloseTagId("");
    }
  }, [department, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const autoCloseMinutesValue = autoCloseEnabled && autoCloseMinutes !== "" 
      ? Number(autoCloseMinutes) 
      : null;

    const aiAutoCloseMinutesValue = aiAutoCloseEnabled && aiAutoCloseMinutes !== ""
      ? Number(aiAutoCloseMinutes)
      : null;

    const humanAutoCloseMinutesValue = humanAutoCloseEnabled && humanAutoCloseMinutes !== ""
      ? Number(humanAutoCloseMinutes)
      : null;

    if (department) {
      await updateMutation.mutateAsync({
        id: department.id,
        name,
        description,
        color,
        whatsapp_number: whatsappNumber || undefined,
        auto_close_enabled: autoCloseEnabled,
        auto_close_minutes: autoCloseMinutesValue,
        send_rating_on_close: sendRatingOnClose,
        ai_auto_close_minutes: aiAutoCloseMinutesValue,
        human_auto_close_minutes: humanAutoCloseMinutesValue,
        human_auto_close_tag_id: humanAutoCloseEnabled && humanAutoCloseTagId ? humanAutoCloseTagId : null,
      });
    } else {
      await createMutation.mutateAsync({
        name,
        description,
        color,
        whatsapp_number: whatsappNumber || undefined,
        auto_close_enabled: autoCloseEnabled,
        auto_close_minutes: autoCloseMinutesValue,
        send_rating_on_close: sendRatingOnClose,
        ai_auto_close_minutes: aiAutoCloseMinutesValue,
        human_auto_close_minutes: humanAutoCloseMinutesValue,
        human_auto_close_tag_id: humanAutoCloseEnabled && humanAutoCloseTagId ? humanAutoCloseTagId : null,
      });
    }

    onOpenChange(false);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{department ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
          <DialogDescription>
            {department ? "Atualize as informações do departamento." : "Adicione um novo departamento organizacional."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Customer Success"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva a função deste departamento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor de Identificação</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Número WhatsApp (com DDI)</Label>
              <Input
                id="whatsapp"
                type="text"
                placeholder="Ex: 5511999999999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                maxLength={13}
              />
              <p className="text-xs text-muted-foreground">
                Apenas números (DDI + DDD + número). Ex: 5511999999999
              </p>
            </div>

            <Separator className="my-4" />

            {/* Auto-close settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Encerramento Automático</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoCloseEnabled">Encerrar por inatividade</Label>
                  <p className="text-xs text-muted-foreground">
                    Fecha conversas automaticamente quando o cliente não responde
                  </p>
                </div>
                <Switch
                  id="autoCloseEnabled"
                  checked={autoCloseEnabled}
                  onCheckedChange={setAutoCloseEnabled}
                />
              </div>

              {autoCloseEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="autoCloseMinutes">Tempo de inatividade (minutos)</Label>
                    <Input
                      id="autoCloseMinutes"
                      type="number"
                      min={5}
                      max={1440}
                      placeholder="Ex: 30"
                      value={autoCloseMinutes}
                      onChange={(e) => setAutoCloseMinutes(e.target.value ? Number(e.target.value) : "")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 5 minutos. Deixe em branco para nunca encerrar automaticamente.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sendRatingOnClose">Enviar pesquisa de satisfação</Label>
                      <p className="text-xs text-muted-foreground">
                        Envia pesquisa CSAT (1-5 estrelas) ao encerrar conversa
                      </p>
                    </div>
                    <Switch
                      id="sendRatingOnClose"
                      checked={sendRatingOnClose}
                      onCheckedChange={setSendRatingOnClose}
                    />
                  </div>
                </>
              )}

              <Separator className="my-2" />

              {/* AI Auto-close settings */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="aiAutoCloseEnabled">Encerrar conversas com IA por inatividade</Label>
                  <p className="text-xs text-muted-foreground">
                    Fecha conversas no modo autopilot quando o cliente não responde à IA
                  </p>
                </div>
                <Switch
                  id="aiAutoCloseEnabled"
                  checked={aiAutoCloseEnabled}
                  onCheckedChange={setAiAutoCloseEnabled}
                />
              </div>

              {aiAutoCloseEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="aiAutoCloseMinutes">Tempo de inatividade da IA (minutos)</Label>
                  <Input
                    id="aiAutoCloseMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    placeholder="Ex: 5"
                    value={aiAutoCloseMinutes}
                    onChange={(e) => setAiAutoCloseMinutes(e.target.value ? Number(e.target.value) : "")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 1 minuto. Encerra quando o cliente não responde à IA neste período.
                  </p>
                </div>
              )}

              <Separator className="my-2" />

              {/* Human Auto-close settings */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="humanAutoCloseEnabled">Encerrar conversas humanas por inatividade</Label>
                  <p className="text-xs text-muted-foreground">
                    Fecha conversas atendidas por humano quando o cliente não responde
                  </p>
                </div>
                <Switch
                  id="humanAutoCloseEnabled"
                  checked={humanAutoCloseEnabled}
                  onCheckedChange={setHumanAutoCloseEnabled}
                />
              </div>

              {humanAutoCloseEnabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="humanAutoCloseMinutes">Tempo de inatividade humano (minutos)</Label>
                    <Input
                      id="humanAutoCloseMinutes"
                      type="number"
                      min={1}
                      max={1440}
                      placeholder="Ex: 5"
                      value={humanAutoCloseMinutes}
                      onChange={(e) => setHumanAutoCloseMinutes(e.target.value ? Number(e.target.value) : "")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 1 minuto. Encerra quando o cliente não responde ao agente humano neste período.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="humanAutoCloseTagId">Tag ao encerrar</Label>
                    <Select value={humanAutoCloseTagId} onValueChange={setHumanAutoCloseTagId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma tag (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags?.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: tag.color || "#6B7280" }}
                              />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Tag aplicada automaticamente ao encerrar por inatividade humana. Se não selecionada, usa a tag padrão.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : department ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
