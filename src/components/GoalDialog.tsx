import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useCreateGoal } from "@/hooks/useCreateGoal";
import { useCreateCSGoal } from "@/hooks/useCreateCSGoal";
import { useOperationalUsers } from "@/hooks/useOperationalUsers";
import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import { Plus } from "lucide-react";

interface SalesGoalFormData {
  title: string;
  description: string;
  period_month: string;
  period_year: string;
  assigned_to: string;
  target_value: string;
  target_deals?: string;
  target_activities?: string;
  commission_rate?: string;
}

interface CSGoalFormData {
  title: string;
  description: string;
  period_month: string;
  period_year: string;
  assigned_to: string;
  target_gmv: string;
  target_upsell: string;
  max_churn_rate: string;
  activation_count?: string;
  bonus_amount?: string;
}

interface GoalDialogProps {
  preSelectedUserId?: string;
}

export function GoalDialog({ preSelectedUserId }: GoalDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [selectedUserRole, setSelectedUserRole] = useState<string | null>(null);
  
  const { register, handleSubmit, reset, setValue, watch } = useForm<SalesGoalFormData | CSGoalFormData>({
    defaultValues: {
      period_month: String(new Date().getMonth() + 1),
      period_year: String(new Date().getFullYear()),
    },
  });

  const { data: operationalUsers, isLoading: isLoadingUsers } = useOperationalUsers();
  const { role: currentUserRole } = useUserRole();
  const createGoal = useCreateGoal();
  const createCSGoal = useCreateCSGoal();

  // Filtrar usuários baseado no role do gestor logado
  // CS Manager vê apenas consultores, outros gestores veem vendedores e consultores
  const eligibleUsers = operationalUsers?.filter(u => {
    if (currentUserRole === "cs_manager") {
      return u.role === "consultant";
    }
    // Admin/Manager veem sales_rep e consultant (support_agent opcional)
    return u.role === "sales_rep" || u.role === "consultant";
  });

  const handleUserSelect = (userId: string) => {
    const user = eligibleUsers?.find(u => u.id === userId);
    setSelectedUserRole(user?.role || null);
    setValue("assigned_to", userId);
  };

  // Pre-select user when dialog opens with preSelectedUserId
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && preSelectedUserId && eligibleUsers) {
      handleUserSelect(preSelectedUserId);
    }
    if (!isOpen) {
      reset();
      setSelectedUserRole(null);
    }
  };

  const onSubmit = async (data: SalesGoalFormData | CSGoalFormData) => {
    console.log("📝 GoalDialog: Submitting goal", data);

    try {
      if (selectedUserRole === "consultant") {
        const csData = data as CSGoalFormData;
        const monthDate = `${csData.period_year}-${String(csData.period_month).padStart(2, '0')}-01`;
        
        await createCSGoal.mutateAsync({
          consultant_id: csData.assigned_to,
          month: monthDate,
          target_gmv: parseFloat(csData.target_gmv),
          target_upsell: parseFloat(csData.target_upsell),
          max_churn_rate: parseFloat(csData.max_churn_rate),
          activation_count: csData.activation_count ? parseInt(csData.activation_count) : 0,
          bonus_amount: csData.bonus_amount ? parseFloat(csData.bonus_amount) : 0,
        });
      } else if (selectedUserRole === "sales_rep") {
        const salesData = data as SalesGoalFormData;
        
        await createGoal.mutateAsync({
          title: salesData.title,
          description: salesData.description,
          goal_type: "individual",
          target_value: parseFloat(salesData.target_value),
          period_month: parseInt(salesData.period_month),
          period_year: parseInt(salesData.period_year),
          assigned_to: salesData.assigned_to,
          commission_rate: salesData.commission_rate ? parseFloat(salesData.commission_rate) : 0,
        });
      }

      reset();
      setSelectedUserRole(null);
      setOpen(false);
    } catch (error) {
      console.error("❌ Error creating goal:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size={preSelectedUserId ? "sm" : "default"}>
          <Plus className="h-4 w-4 mr-2" />
          {preSelectedUserId ? "Definir Meta" : "Nova Meta"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {selectedUserRole === "consultant" ? "Definir Metas de CS" : "Definir Metas de Vendas"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Seleção de Colaborador */}
          <div>
            <Label htmlFor="assigned_to">Colaborador *</Label>
            <Select 
              onValueChange={handleUserSelect} 
              required 
              disabled={isLoadingUsers || !!preSelectedUserId}
              value={preSelectedUserId || undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingUsers ? "Carregando..." : "Selecione o colaborador"} />
              </SelectTrigger>
              <SelectContent>
                {eligibleUsers && eligibleUsers.length > 0 ? (
                  eligibleUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.role === "sales_rep" ? "Vendedor" : user.role === "consultant" ? "Consultor CS" : "Suporte"})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-users" disabled>
                    Nenhum colaborador operacional encontrado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Campos Comuns */}
          {selectedUserRole && (
            <>
              <div>
                <Label htmlFor="title">Título da Meta *</Label>
                <Input 
                  id="title" 
                  {...register("title", { required: true })} 
                  placeholder={selectedUserRole === "consultant" ? "Ex: Meta CS Março 2025" : "Ex: Meta Q1 2025"} 
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  {...register("description")} 
                  placeholder="Detalhes sobre a meta..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>
            </>
          )}

          {/* Campos para VENDEDOR (sales_rep) */}
          {selectedUserRole === "sales_rep" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_value">Meta de Vendas (R$) *</Label>
                  <Input 
                    id="target_value" 
                    type="number" 
                    step="0.01" 
                    {...register("target_value", { required: true })} 
                    placeholder="50000.00" 
                  />
                </div>

                <div>
                  <Label htmlFor="target_deals">Meta de Deals (Qtd)</Label>
                  <Input 
                    id="target_deals" 
                    type="number" 
                    {...register("target_deals")} 
                    placeholder="10" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_activities">Meta de Atividades (Qtd)</Label>
                  <Input 
                    id="target_activities" 
                    type="number" 
                    {...register("target_activities")} 
                    placeholder="50" 
                  />
                </div>

                <div>
                  <Label htmlFor="commission_rate">Comissão (%)</Label>
                  <Input 
                    id="commission_rate" 
                    type="number" 
                    step="0.01" 
                    {...register("commission_rate")} 
                    placeholder="5.00" 
                  />
                </div>
              </div>
            </>
          )}

          {/* Campos para CONSULTOR (consultant) */}
          {selectedUserRole === "consultant" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_gmv">Meta de GMV da Carteira (R$) *</Label>
                  <Input 
                    id="target_gmv" 
                    type="number" 
                    step="0.01" 
                    {...register("target_gmv", { required: true })} 
                    placeholder="100000.00" 
                  />
                </div>

                <div>
                  <Label htmlFor="max_churn_rate">Churn Máximo (%) *</Label>
                  <Input 
                    id="max_churn_rate" 
                    type="number" 
                    step="0.01" 
                    {...register("max_churn_rate", { required: true })} 
                    placeholder="2.00" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_upsell">Meta de Upsell/Expansão (R$) *</Label>
                  <Input 
                    id="target_upsell" 
                    type="number" 
                    step="0.01" 
                    {...register("target_upsell", { required: true })} 
                    placeholder="20000.00" 
                  />
                </div>

                <div>
                  <Label htmlFor="activation_count">Meta de Ativações (Qtd)</Label>
                  <Input 
                    id="activation_count" 
                    type="number" 
                    {...register("activation_count")} 
                    placeholder="5" 
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bonus_amount">Bônus por Atingimento (R$)</Label>
                <Input 
                  id="bonus_amount" 
                  type="number" 
                  step="0.01" 
                  {...register("bonus_amount")} 
                  placeholder="500.00" 
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!selectedUserRole || createGoal.isPending || createCSGoal.isPending}
            >
              {(createGoal.isPending || createCSGoal.isPending) ? "Criando..." : "Criar Meta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
