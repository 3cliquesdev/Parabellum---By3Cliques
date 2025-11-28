import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Target } from "lucide-react";
import { useCreateDeal, useUpdateDeal } from "@/hooks/useDeals";
import { useContacts } from "@/hooks/useContacts";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useProducts } from "@/hooks/useProducts";
import { useStages } from "@/hooks/useStages";
import { usePipelines } from "@/hooks/usePipelines";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";

const dealSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(100),
  value: z.string().optional().nullable(),
  currency: z.string().optional(),
  contact_id: z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  status: z.enum(["open", "won", "lost"]),
  assigned_to: z.string().uuid().optional().nullable(),
  lost_reason: z.string().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  probability: z.number().min(0).max(100).optional(),
  expected_revenue: z.string().optional().nullable(),
  success_criteria: z.string().optional().nullable(),
  pain_points: z.string().optional().nullable(),
  churn_risk: z.enum(["low", "medium", "high"]).optional().nullable(),
}).refine((data) => {
  if (data.status === "lost" && (!data.lost_reason || data.lost_reason.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Motivo da perda é obrigatório ao marcar negócio como perdido",
  path: ["lost_reason"],
});

type DealFormData = z.infer<typeof dealSchema>;

interface DealDialogProps {
  deal?: Tables<"deals">;
  trigger: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  prefilledContactId?: string;
}

export default function DealDialog({ deal, trigger, onOpenChange, prefilledContactId }: DealDialogProps) {
  const [open, setOpen] = useState(false);
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();
  const { data: contacts } = useContacts();
  const { data: organizations } = useOrganizations();
  const { data: pipelines } = usePipelines();
  const { data: salesReps, isLoading: salesRepsLoading } = useSalesReps();
  const { data: products } = useProducts();
  const { role } = useUserRole();

  console.log("[DealDialog] Sales reps data:", { salesReps, salesRepsLoading });

  const isAdminOrManager = role === "admin" || role === "manager";

  // Encontrar pipeline default
  const defaultPipeline = pipelines?.find(p => p.is_default) || pipelines?.[0];

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: deal?.title || "",
      value: deal?.value?.toString() || "",
      currency: deal?.currency || "BRL",
      contact_id: prefilledContactId || deal?.contact_id || "",
      organization_id: deal?.organization_id || "",
      pipeline_id: deal?.pipeline_id || defaultPipeline?.id || "",
      stage_id: deal?.stage_id || "",
      status: deal?.status || "open",
      assigned_to: (deal as any)?.assigned_to || "",
      lost_reason: (deal as any)?.lost_reason || "",
      product_id: (deal as any)?.product_id || "",
      probability: (deal as any)?.probability || 50,
      expected_revenue: (deal as any)?.expected_revenue?.toString() || "",
      success_criteria: (deal as any)?.success_criteria || "",
      pain_points: (deal as any)?.pain_points || "",
      churn_risk: (deal as any)?.churn_risk || "",
    },
  });

  const watchStatus = form.watch("status");
  const watchPipelineId = form.watch("pipeline_id");

  // Buscar stages do pipeline selecionado
  const { data: stages } = useStages(watchPipelineId);

  // Atualizar stage_id quando pipeline mudar
  useEffect(() => {
    if (stages && stages.length > 0 && watchPipelineId) {
      const currentStageId = form.getValues("stage_id");
      const stageExists = stages.find(s => s.id === currentStageId);
      
      if (!stageExists) {
        form.setValue("stage_id", stages[0].id);
      }
    }
  }, [stages, watchPipelineId, form]);

  const onSubmit = async (data: DealFormData) => {
    console.log("[DealDialog] onSubmit called with data:", data);
    
    // Validação: garantir que stage_id e pipeline_id existem
    if (!data.stage_id) {
      console.error("[DealDialog] stage_id is required but missing", data);
      form.setError("stage_id", {
        type: "manual",
        message: "Etapa é obrigatória",
      });
      return;
    }

    if (!data.pipeline_id) {
      console.error("[DealDialog] pipeline_id is required but missing", data);
      form.setError("pipeline_id", {
        type: "manual",
        message: "Pipeline é obrigatório",
      });
      return;
    }

    console.log("[DealDialog] All validations passed");

    const payload = {
      title: data.title,
      value: data.value ? parseFloat(data.value) : null,
      currency: data.currency || "BRL",
      contact_id: data.contact_id || null,
      organization_id: data.organization_id || null,
      pipeline_id: data.pipeline_id,
      stage_id: data.stage_id,
      status: data.status,
      assigned_to: data.assigned_to || null,
      lost_reason: data.lost_reason || null,
      product_id: data.product_id || null,
      probability: data.probability || null,
      expected_revenue: data.expected_revenue ? parseFloat(data.expected_revenue) : null,
      success_criteria: data.success_criteria || null,
      pain_points: data.pain_points || null,
      churn_risk: data.churn_risk || null,
    };

    console.log("[DealDialog] Payload to submit:", payload);

    if (deal) {
      console.log("[DealDialog] UPDATE mode for deal:", deal.id);
      await updateDeal.mutateAsync({ id: deal.id, updates: payload });
    } else {
      console.log("[DealDialog] CREATE mode");
      await createDeal.mutateAsync(payload);
    }

    setOpen(false);
    form.reset();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deal ? "Editar Negócio" : "Novo Negócio"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do negócio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (opcional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moeda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="BRL" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BRL">BRL (R$)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isAdminOrManager && (
              <FormField
                control={form.control}
                name="pipeline_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pipeline</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um pipeline" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pipelines?.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                            {pipeline.is_default && " (Padrão)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="contact_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contato (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um contato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contacts?.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.first_name} {contact.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="organization_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organização (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma organização" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {organizations?.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma etapa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atribuir para (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={salesRepsLoading ? "Carregando..." : "Selecione um vendedor"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salesReps && salesReps.length > 0 ? (
                        salesReps.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>
                            {rep.full_name} {rep.job_title && `(${rep.job_title})`}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-data" disabled>
                          {salesRepsLoading ? "Carregando..." : "Nenhum vendedor disponível"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="won">Ganho</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchStatus === "lost" && (
              <FormField
                control={form.control}
                name="lost_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo da Perda *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o motivo da perda do negócio..."
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products?.filter(p => p.is_active).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                          {product.requires_account_manager && " 🎯"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ═══════════════════════════════════════════════════ */}
            {/* SEÇÃO: QUALIFICAÇÃO & HANDOFF PARA CS             */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Qualificação & Handoff
              </h3>

              {/* Slider: Probabilidade de Fechamento */}
              <FormField
                control={form.control}
                name="probability"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Probabilidade de Fechamento: {field.value}%</FormLabel>
                    <FormControl>
                      <Slider
                        value={[field.value || 50]}
                        onValueChange={([val]) => field.onChange(val)}
                        max={100}
                        step={5}
                        className="mt-2"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Input: Expectativa de Faturamento Mensal */}
              <FormField
                control={form.control}
                name="expected_revenue"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Expectativa Faturamento Mensal (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ex: 50000" {...field} value={field.value || ""} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Meta de receita mensal que o cliente espera alcançar
                    </p>
                  </FormItem>
                )}
              />

              {/* Textarea: Critério de Sucesso */}
              <FormField
                control={form.control}
                name="success_criteria"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>O que é Sucesso para esse Cliente?</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ex: Reduzir churn em 20%, aumentar ticket médio, automatizar processos..."
                        {...field}
                        value={field.value || ""}
                        rows={3}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Textarea: Dores Principais */}
              <FormField
                control={form.control}
                name="pain_points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Principais Dores do Cliente</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ex: Gestão manual de leads, falta de controle financeiro, equipe desorganizada..."
                        {...field}
                        value={field.value || ""}
                        rows={3}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Dropdown: Risco de Churn */}
              <FormField
                control={form.control}
                name="churn_risk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risco de Churn</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o risco..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Baixo
                          </span>
                        </SelectItem>
                        <SelectItem value="medium">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-yellow-500" />
                            Médio
                          </span>
                        </SelectItem>
                        <SelectItem value="high">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            Alto
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createDeal.isPending || updateDeal.isPending}>
                {deal ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
