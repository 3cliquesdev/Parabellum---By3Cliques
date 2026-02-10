import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTicketCategory, useUpdateTicketCategory, type TicketCategory } from "@/hooks/useTicketCategories";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: TicketCategory | null;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const unitLabels: Record<string, string> = {
  hours: "Horas",
  business_hours: "Horas úteis",
  business_days: "Dias úteis",
};

export default function CategoryDialog({ open, onOpenChange, category }: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [priority, setPriority] = useState("medium");

  // SLA fields
  const [responseTimeValue, setResponseTimeValue] = useState<number | "">("");
  const [responseTimeUnit, setResponseTimeUnit] = useState<string>("hours");
  const [resolutionTimeValue, setResolutionTimeValue] = useState<number | "">("");
  const [resolutionTimeUnit, setResolutionTimeUnit] = useState<string>("hours");

  const createMutation = useCreateTicketCategory();
  const updateMutation = useUpdateTicketCategory();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description || "");
      setColor(category.color);
      setPriority(category.priority || "medium");
      // Load SLA policy for this category
      loadSlaPolicy(category.id, category.priority);
    } else {
      setName("");
      setDescription("");
      setColor("#3B82F6");
      setPriority("medium");
      setResponseTimeValue("");
      setResponseTimeUnit("hours");
      setResolutionTimeValue("");
      setResolutionTimeUnit("hours");
    }
  }, [category, open]);

  const loadSlaPolicy = async (categoryId: string, prio: string) => {
    const { data } = await supabase
      .from("sla_policies")
      .select("*")
      .eq("category_id", categoryId)
      .eq("priority", prio)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      setResponseTimeValue(data.response_time_value);
      setResponseTimeUnit(data.response_time_unit);
      setResolutionTimeValue(data.resolution_time_value);
      setResolutionTimeUnit(data.resolution_time_unit);
    } else {
      setResponseTimeValue("");
      setResponseTimeUnit("hours");
      setResolutionTimeValue("");
      setResolutionTimeUnit("hours");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasResponse = responseTimeValue !== "" && Number(responseTimeValue) > 0;
    const hasResolution = resolutionTimeValue !== "" && Number(resolutionTimeValue) > 0;

    if (hasResponse !== hasResolution) {
      toast.error("Preencha ambos os campos de SLA (resposta e resolução) ou deixe ambos vazios.");
      return;
    }

    let savedCategory: any;
    if (category) {
      savedCategory = await updateMutation.mutateAsync({ id: category.id, name, description, color, priority } as any);
    } else {
      savedCategory = await createMutation.mutateAsync({ name, description, color, priority } as any);
    }

    // Manage SLA policy
    const catId = savedCategory?.id || category?.id;
    if (catId) {
      const hasResponse = responseTimeValue !== "" && responseTimeValue > 0;
      const hasResolution = resolutionTimeValue !== "" && resolutionTimeValue > 0;

      if (hasResponse && hasResolution) {
        // Delete existing then insert new policy
        await supabase
          .from("sla_policies")
          .delete()
          .eq("category_id", catId)
          .eq("priority", priority);

        await supabase
          .from("sla_policies")
          .insert({
            category_id: catId,
            priority,
            response_time_value: Number(responseTimeValue),
            response_time_unit: responseTimeUnit as any,
            resolution_time_value: Number(resolutionTimeValue),
            resolution_time_unit: resolutionTimeUnit as any,
            is_active: true,
          });
      } else {
        // Both empty — remove any existing policy to avoid orphan data
        await supabase
          .from("sla_policies")
          .delete()
          .eq("category_id", catId)
          .eq("priority", priority);
      }

      queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
    }

    onOpenChange(false);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          <DialogDescription>
            {category ? "Atualize as informações da categoria." : "Adicione uma nova categoria para tickets."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome *</Label>
              <Input id="cat-name" placeholder="Ex: Bug Report" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Descrição</Label>
              <Textarea id="cat-desc" placeholder="Descreva esta categoria..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade Padrão</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-color">Cor</Label>
              <div className="flex gap-2">
                <Input id="cat-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-20 h-10" />
                <Input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
              </div>
            </div>

            {/* SLA Section */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-base font-semibold">Configuração de SLA</Label>
              <p className="text-sm text-muted-foreground mb-3">Defina os tempos de atendimento para esta categoria.</p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tempo de 1ª Resposta</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 2"
                      value={responseTimeValue}
                      onChange={(e) => setResponseTimeValue(e.target.value ? Number(e.target.value) : "")}
                      className="w-24"
                    />
                    <Select value={responseTimeUnit} onValueChange={setResponseTimeUnit}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(unitLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tempo de Resolução</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 24"
                      value={resolutionTimeValue}
                      onChange={(e) => setResolutionTimeValue(e.target.value ? Number(e.target.value) : "")}
                      className="w-24"
                    />
                    <Select value={resolutionTimeUnit} onValueChange={setResolutionTimeUnit}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(unitLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : category ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
