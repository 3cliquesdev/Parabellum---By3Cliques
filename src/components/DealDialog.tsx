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
import { Button } from "@/components/ui/button";
import { useCreateDeal, useUpdateDeal } from "@/hooks/useDeals";
import { useContacts } from "@/hooks/useContacts";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useStages } from "@/hooks/useStages";
import { useSalesReps } from "@/hooks/useSalesReps";
import type { Tables } from "@/integrations/supabase/types";

const dealSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(100),
  value: z.string().optional().nullable(),
  currency: z.string().optional(),
  contact_id: z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  stage_id: z.string().uuid(),
  status: z.enum(["open", "won", "lost"]),
  assigned_to: z.string().uuid().optional().nullable(),
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
  const { data: stages } = useStages();
  const { data: salesReps } = useSalesReps();

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: deal?.title || "",
      value: deal?.value?.toString() || "",
      currency: deal?.currency || "BRL",
      contact_id: prefilledContactId || deal?.contact_id || "",
      organization_id: deal?.organization_id || "",
      stage_id: deal?.stage_id || "",
      status: deal?.status || "open",
      assigned_to: (deal as any)?.assigned_to || "",
    },
  });

  useEffect(() => {
    if (stages && stages.length > 0 && !deal) {
      const currentStageId = form.getValues("stage_id");
      if (!currentStageId || currentStageId === "") {
        form.setValue("stage_id", stages[0].id);
      }
    }
  }, [stages, deal, form]);

  const onSubmit = async (data: DealFormData) => {
    console.log("[DealDialog] onSubmit called with data:", data);
    
    // Validação: garantir que stage_id existe
    if (!data.stage_id) {
      console.error("[DealDialog] stage_id is required but missing", data);
      form.setError("stage_id", {
        type: "manual",
        message: "Etapa é obrigatória",
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
      stage_id: data.stage_id,
      status: data.status,
      assigned_to: data.assigned_to || null,
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
      <DialogContent className="sm:max-w-[600px]">
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
                        <SelectValue placeholder="Selecione um vendedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salesReps?.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.full_name} {rep.job_title && `(${rep.job_title})`}
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
