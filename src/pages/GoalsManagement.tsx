import { useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import { useGoals } from "@/hooks/useGoals";
import { useCSGoals } from "@/hooks/useCSGoals";
import { useUserRole } from "@/hooks/useUserRole";
import { useUpsertGoal } from "@/hooks/useUpsertGoal";
import { useUpsertCSGoal } from "@/hooks/useUpsertCSGoal";
import { useCopyGoalsFromPreviousMonth } from "@/hooks/useCopyGoalsFromPreviousMonth";
import { useTeamGoalProgress } from "@/hooks/useTeamGoalProgress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Copy, Target, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TeamOverviewCards } from "@/components/goals/TeamOverviewCards";
import { GoalsTable } from "@/components/goals/GoalsTable";

export default function GoalsManagement() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: salesGoals } = useGoals(selectedMonth, selectedYear);
  const formattedMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const { data: csGoals } = useCSGoals(undefined, formattedMonth);
  const { data: teamProgress, isLoading: progressLoading } = useTeamGoalProgress(selectedMonth, selectedYear);
  const upsertGoal = useUpsertGoal();
  const upsertCSGoal = useUpsertCSGoal();
  const copyGoals = useCopyGoalsFromPreviousMonth();
  const { role: currentUserRole } = useUserRole();

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const eligibleUsers = (users || []).filter((u) => {
    if (currentUserRole === "cs_manager") {
      return u.role === "consultant";
    }
    return u.role === "sales_rep" || u.role === "consultant";
  });

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

  const handleSaveGoal = async (userId: string, role: string, fullName: string, values: { primary: string; secondary: string }) => {
    if (!values.primary) {
      toast.error("Preencha a meta principal");
      return;
    }

    const primaryValue = parseFloat(values.primary.replace(/[^\d,]/g, '').replace(',', '.'));
    const secondaryValue = values.secondary ? parseFloat(values.secondary.replace(/[^\d,]/g, '').replace(',', '.')) : 0;

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Target className="w-6 h-6 md:w-7 md:h-7 text-primary" />
            </div>
            Definição de Metas
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure e acompanhe as metas mensais da equipe
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-lg border">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select
              value={`${selectedYear}-${selectedMonth}`}
              onValueChange={(value) => {
                const [year, month] = value.split('-');
                setSelectedYear(parseInt(year));
                setSelectedMonth(parseInt(month));
              }}
            >
              <SelectTrigger className="w-[160px] border-0 bg-transparent p-0 h-auto font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[-1, 0, 1, 2, 3].map(offset => {
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

          <Button
            variant="outline"
            onClick={handleCopyPreviousMonth}
            disabled={copyGoals.isPending}
            className="gap-2"
          >
            {copyGoals.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Copiar do Mês Anterior</span>
            <span className="sm:hidden">Copiar</span>
          </Button>
        </div>
      </div>

      {/* Team Overview Cards */}
      <TeamOverviewCards
        teamTargetValue={teamProgress?.teamTargetValue || 0}
        teamCurrentValue={teamProgress?.teamCurrentValue || 0}
        teamPercentage={teamProgress?.teamPercentage || 0}
        members={teamProgress?.members || []}
        isLoading={progressLoading}
      />

      {/* Goals Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Metas por Colaborador
        </h2>
        <GoalsTable
          users={eligibleUsers}
          teamProgress={teamProgress?.members || []}
          getExistingGoal={getExistingGoal}
          onSaveGoal={handleSaveGoal}
          isSaving={upsertGoal.isPending || upsertCSGoal.isPending}
        />
      </div>
    </div>
  );
}
