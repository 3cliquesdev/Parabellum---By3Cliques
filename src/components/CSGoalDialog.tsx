import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useCreateCSGoal } from "@/hooks/useCreateCSGoal";
import { useUpdateCSGoal } from "@/hooks/useUpdateCSGoal";
import { useState, useEffect } from "react";
import { Target } from "lucide-react";
import type { CSGoal } from "@/hooks/useCSGoals";

interface CSGoalFormData {
  target_gmv: string;
  target_upsell: string;
  max_churn_rate: string;
  activation_count: string;
  bonus_amount: string;
}

interface CSGoalDialogProps {
  consultantId: string;
  consultantName: string;
  existingGoal?: CSGoal;
  currentMonth: string; // YYYY-MM-DD format (first day of month)
}

export function CSGoalDialog({ consultantId, consultantName, existingGoal, currentMonth }: CSGoalDialogProps) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<CSGoalFormData>({
    defaultValues: existingGoal ? {
      target_gmv: existingGoal.target_gmv.toString(),
      target_upsell: existingGoal.target_upsell.toString(),
      max_churn_rate: existingGoal.max_churn_rate.toString(),
      activation_count: existingGoal.activation_count.toString(),
      bonus_amount: existingGoal.bonus_amount.toString(),
    } : {
      target_gmv: "50000",
      target_upsell: "10000",
      max_churn_rate: "2.0",
      activation_count: "5",
      bonus_amount: "2000",
    },
  });

  const createGoal = useCreateCSGoal();
  const updateGoal = useUpdateCSGoal();

  useEffect(() => {
    if (existingGoal) {
      reset({
        target_gmv: existingGoal.target_gmv.toString(),
        target_upsell: existingGoal.target_upsell.toString(),
        max_churn_rate: existingGoal.max_churn_rate.toString(),
        activation_count: existingGoal.activation_count.toString(),
        bonus_amount: existingGoal.bonus_amount.toString(),
      });
    }
  }, [existingGoal, reset]);

  const onSubmit = async (data: CSGoalFormData) => {
    console.log("📝 CSGoalDialog: Submitting CS goal", data);

    if (existingGoal) {
      await updateGoal.mutateAsync({
        id: existingGoal.id,
        target_gmv: parseFloat(data.target_gmv),
        target_upsell: parseFloat(data.target_upsell),
        max_churn_rate: parseFloat(data.max_churn_rate),
        activation_count: parseInt(data.activation_count),
        bonus_amount: parseFloat(data.bonus_amount),
      });
    } else {
      await createGoal.mutateAsync({
        consultant_id: consultantId,
        month: currentMonth,
        target_gmv: parseFloat(data.target_gmv),
        target_upsell: parseFloat(data.target_upsell),
        max_churn_rate: parseFloat(data.max_churn_rate),
        activation_count: parseInt(data.activation_count),
        bonus_amount: parseFloat(data.bonus_amount),
      });
    }

    setOpen(false);
  };

  const monthName = new Date(currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Target className="h-4 w-4 mr-2" />
          {existingGoal ? "Editar Metas" : "Definir Metas"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {existingGoal ? "Editar" : "Definir"} Metas de CS - {consultantName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Período: {monthName}</p>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target_gmv">💰 Meta de GMV (R$) *</Label>
              <Input 
                id="target_gmv" 
                type="number" 
                step="0.01" 
                {...register("target_gmv", { required: true })} 
                placeholder="50000.00" 
              />
              <p className="text-xs text-muted-foreground mt-1">Volume total transacionado pela carteira</p>
            </div>

            <div>
              <Label htmlFor="target_upsell">📈 Meta de Upsell (R$) *</Label>
              <Input 
                id="target_upsell" 
                type="number" 
                step="0.01" 
                {...register("target_upsell", { required: true })} 
                placeholder="10000.00" 
              />
              <p className="text-xs text-muted-foreground mt-1">Vendas adicionais (expansão)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max_churn_rate">🛡️ Teto de Churn (%) *</Label>
              <Input 
                id="max_churn_rate" 
                type="number" 
                step="0.1" 
                {...register("max_churn_rate", { required: true })} 
                placeholder="2.0" 
              />
              <p className="text-xs text-muted-foreground mt-1">Taxa máxima de cancelamento aceitável</p>
            </div>

            <div>
              <Label htmlFor="activation_count">🚀 Meta de Ativações *</Label>
              <Input 
                id="activation_count" 
                type="number" 
                {...register("activation_count", { required: true })} 
                placeholder="5" 
              />
              <p className="text-xs text-muted-foreground mt-1">Clientes novos ativados</p>
            </div>
          </div>

          <div>
            <Label htmlFor="bonus_amount">🎁 Valor do Bônus (R$) *</Label>
            <Input 
              id="bonus_amount" 
              type="number" 
              step="0.01" 
              {...register("bonus_amount", { required: true })} 
              placeholder="2000.00" 
            />
            <p className="text-xs text-muted-foreground mt-1">Bônus se todas as metas forem atingidas</p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createGoal.isPending || updateGoal.isPending}>
              {(createGoal.isPending || updateGoal.isPending) ? "Salvando..." : existingGoal ? "Atualizar Metas" : "Criar Metas"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
