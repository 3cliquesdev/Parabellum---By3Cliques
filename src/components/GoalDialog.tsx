import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useCreateGoal } from "@/hooks/useCreateGoal";
import { useUsers } from "@/hooks/useUsers";
import { useState } from "react";
import { Plus } from "lucide-react";

interface GoalFormData {
  title: string;
  description: string;
  goal_type: "individual" | "team" | "company";
  target_value: string;
  period_month: string;
  period_year: string;
  assigned_to?: string;
  department?: string;
  commission_rate?: string;
}

export function GoalDialog() {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, watch, reset, setValue } = useForm<GoalFormData>({
    defaultValues: {
      period_month: String(new Date().getMonth() + 1),
      period_year: String(new Date().getFullYear()),
      goal_type: "individual",
    },
  });

  const goalType = watch("goal_type");
  const { data: users } = useUsers();
  const createGoal = useCreateGoal();

  const onSubmit = async (data: GoalFormData) => {
    console.log("📝 GoalDialog: Submitting goal", data);

    await createGoal.mutateAsync({
      title: data.title,
      description: data.description,
      goal_type: data.goal_type,
      target_value: parseFloat(data.target_value),
      period_month: parseInt(data.period_month),
      period_year: parseInt(data.period_year),
      assigned_to: data.assigned_to,
      department: data.department,
      commission_rate: data.commission_rate ? parseFloat(data.commission_rate) : 0,
    });

    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Criar Nova Meta de Vendas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Título da Meta *</Label>
            <Input id="title" {...register("title", { required: true })} placeholder="Ex: Meta Q1 2025" />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" {...register("description")} placeholder="Detalhes sobre a meta..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="goal_type">Tipo de Meta *</Label>
              <Select onValueChange={(value) => setValue("goal_type", value as any)} defaultValue="individual">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual (Vendedor)</SelectItem>
                  <SelectItem value="team">Equipe (Departamento)</SelectItem>
                  <SelectItem value="company">Empresa (Geral)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="target_value">Valor Alvo (R$) *</Label>
              <Input 
                id="target_value" 
                type="number" 
                step="0.01" 
                {...register("target_value", { required: true })} 
                placeholder="50000.00" 
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="period_month">Mês *</Label>
              <Select onValueChange={(value) => setValue("period_month", value)} defaultValue={String(new Date().getMonth() + 1)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Janeiro</SelectItem>
                  <SelectItem value="2">Fevereiro</SelectItem>
                  <SelectItem value="3">Março</SelectItem>
                  <SelectItem value="4">Abril</SelectItem>
                  <SelectItem value="5">Maio</SelectItem>
                  <SelectItem value="6">Junho</SelectItem>
                  <SelectItem value="7">Julho</SelectItem>
                  <SelectItem value="8">Agosto</SelectItem>
                  <SelectItem value="9">Setembro</SelectItem>
                  <SelectItem value="10">Outubro</SelectItem>
                  <SelectItem value="11">Novembro</SelectItem>
                  <SelectItem value="12">Dezembro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="period_year">Ano *</Label>
              <Input 
                id="period_year" 
                type="number" 
                {...register("period_year", { required: true })} 
                placeholder="2025" 
              />
            </div>

            <div>
              <Label htmlFor="commission_rate">Taxa Comissão (%)</Label>
              <Input 
                id="commission_rate" 
                type="number" 
                step="0.01" 
                {...register("commission_rate")} 
                placeholder="5.00" 
              />
            </div>
          </div>

          {goalType === "individual" && (
            <div>
              <Label htmlFor="assigned_to">Vendedor Responsável *</Label>
              <Select onValueChange={(value) => setValue("assigned_to", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {goalType === "team" && (
            <div>
              <Label htmlFor="department">Departamento *</Label>
              <Select onValueChange={(value) => setValue("department", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createGoal.isPending}>
              {createGoal.isPending ? "Criando..." : "Criar Meta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
