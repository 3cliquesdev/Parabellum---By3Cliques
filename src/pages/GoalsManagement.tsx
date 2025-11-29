import { useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import { useGoals } from "@/hooks/useGoals";
import { useCSGoals } from "@/hooks/useCSGoals";
import { useUpsertGoal } from "@/hooks/useUpsertGoal";
import { useUpsertCSGoal } from "@/hooks/useUpsertCSGoal";
import { useCopyGoalsFromPreviousMonth } from "@/hooks/useCopyGoalsFromPreviousMonth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Copy, Save, Target } from "lucide-react";
import { toast } from "sonner";

export default function GoalsManagement() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: salesGoals } = useGoals(selectedMonth, selectedYear);
  const formattedMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const { data: csGoals } = useCSGoals(undefined, formattedMonth);

  const upsertGoal = useUpsertGoal();
  const upsertCSGoal = useUpsertCSGoal();
  const copyGoals = useCopyGoalsFromPreviousMonth();

  // Local state for form inputs
  const [goalValues, setGoalValues] = useState<Record<string, { primary: string; secondary: string }>>({});

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const eligibleUsers = users?.filter(u => 
    u.role === "sales_rep" || u.role === "consultant"
  ) || [];

  const handleCopyPreviousMonth = async () => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    
    await copyGoals.mutateAsync({
      fromMonth: prevMonth,
      fromYear: prevYear,
      toMonth: selectedMonth,
      toYear: selectedYear,
    });
  };

  const handleSaveGoal = async (userId: string, role: string, fullName: string) => {
    const values = goalValues[userId];
    if (!values?.primary) {
      toast.error("Preencha a meta principal");
      return;
    }

    const primaryValue = parseFloat(values.primary.replace(/[^\d,]/g, '').replace(',', '.'));
    const secondaryValue = values.secondary ? parseFloat(values.secondary) : 0;

    if (role === "sales_rep") {
      await upsertGoal.mutateAsync({
        userId,
        month: selectedMonth,
        year: selectedYear,
        targetValue: primaryValue,
        commissionRate: secondaryValue,
      });
    } else if (role === "consultant") {
      await upsertCSGoal.mutateAsync({
        consultantId: userId,
        month: formattedMonth,
        targetGmv: primaryValue,
        targetUpsell: secondaryValue,
      });
    }

    toast.success(`Meta de ${fullName} atualizada para ${monthNames[selectedMonth - 1]} ${selectedYear}`);
  };

  const getExistingGoal = (userId: string, role: string) => {
    if (role === "sales_rep") {
      return salesGoals?.find(g => g.assigned_to === userId);
    } else {
      return csGoals?.find(g => g.consultant_id === userId);
    }
  };

  if (usersLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Target className="w-8 h-8 text-primary" />
              Definição de Metas
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure as metas mensais para toda a equipe
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleCopyPreviousMonth}
            disabled={copyGoals.isPending}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copiar do Mês Anterior
          </Button>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Mês de Referência:</span>
          <Select
            value={`${selectedYear}-${selectedMonth}`}
            onValueChange={(value) => {
              const [year, month] = value.split('-');
              setSelectedYear(parseInt(year));
              setSelectedMonth(parseInt(month));
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2].map(offset => {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                return (
                  <SelectItem key={`${year}-${month}`} value={`${year}-${month}`}>
                    {monthNames[month - 1]} {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Goals Table */}
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Meta Principal</TableHead>
                <TableHead>Meta Secundária</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligibleUsers.map((user) => {
                const existing = getExistingGoal(user.id, user.role);
                const isSalesRep = user.role === "sales_rep";

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.full_name?.[0] || user.email?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.full_name || user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isSalesRep ? "default" : "secondary"}>
                        {isSalesRep ? "🎯 Vendedor" : "🤝 Consultor"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {isSalesRep ? "Meta de Vendas (R$)" : "Meta de GMV (R$)"}
                        </label>
                        <Input
                          type="text"
                          placeholder="R$ 0,00"
                          defaultValue={
                            existing 
                              ? isSalesRep 
                                ? (existing as any).target_value?.toLocaleString('pt-BR') 
                                : (existing as any).target_gmv?.toLocaleString('pt-BR')
                              : ""
                          }
                          onChange={(e) => setGoalValues(prev => ({
                            ...prev,
                            [user.id]: { ...prev[user.id], primary: e.target.value }
                          }))}
                          className="w-40"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {isSalesRep ? "Comissão (%)" : "Meta Upsell (R$)"}
                        </label>
                        <Input
                          type="text"
                          placeholder={isSalesRep ? "0%" : "R$ 0,00"}
                          defaultValue={
                            existing 
                              ? isSalesRep 
                                ? (existing as any).commission_rate || "" 
                                : (existing as any).target_upsell?.toLocaleString('pt-BR') || ""
                              : ""
                          }
                          onChange={(e) => setGoalValues(prev => ({
                            ...prev,
                            [user.id]: { ...prev[user.id], secondary: e.target.value }
                          }))}
                          className="w-32"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleSaveGoal(user.id, user.role, user.full_name || user.email)}
                        disabled={upsertGoal.isPending || upsertCSGoal.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
