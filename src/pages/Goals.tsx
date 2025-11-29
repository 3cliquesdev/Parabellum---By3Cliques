import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Calendar, Users } from "lucide-react";
import { GoalDialog } from "@/components/GoalDialog";
import { GoalCard } from "@/components/GoalCard";
import { PerformanceRanking } from "@/components/PerformanceRanking";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { useGoals } from "@/hooks/useGoals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useConsultants } from "@/hooks/useConsultants";
import { useCSGoals } from "@/hooks/useCSGoals";
import { CSGoalDialog } from "@/components/CSGoalDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Goals() {
  const { role, loading: roleLoading } = useUserRole();
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { data: goals, isLoading } = useGoals(selectedMonth, selectedYear);
  const { data: consultants } = useConsultants();
  
  // Format month as YYYY-MM-01 for CS goals
  const formattedMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;

  if (roleLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Metas e Objetivos</h1>
              <p className="text-muted-foreground">
                Defina e acompanhe metas de vendas mensais
              </p>
            </div>
          </div>

          {role === "admin" && <GoalDialog />}
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedMonth)}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((month, index) => (
                  <SelectItem key={index} value={String(index + 1)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs: Minhas Metas / Metas de CS / Dashboard */}
        <Tabs defaultValue="goals" className="w-full">
          <TabsList className={`grid w-full ${role === 'admin' ? 'max-w-2xl grid-cols-3' : 'max-w-md grid-cols-2'}`}>
            <TabsTrigger value="goals">Minhas Metas</TabsTrigger>
            {role === "admin" && <TabsTrigger value="cs-goals">Metas de CS</TabsTrigger>}
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          {/* Tab: Minhas Metas */}
          <TabsContent value="goals" className="mt-6">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-96" />
                ))}
              </div>
            ) : goals && goals.length > 0 ? (
              <div className="space-y-8">
                {goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma meta encontrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {role === "admin" 
                    ? "Crie uma nova meta para começar a acompanhar o progresso da equipe." 
                    : "Aguardando definição de metas pelo administrador."}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab: Metas de CS (Admin Only) */}
          {role === "admin" && (
            <TabsContent value="cs-goals" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Users className="h-4 w-4" />
                  <span>Defina metas mensais para cada consultor da equipe</span>
                </div>

                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Consultor</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consultants?.map((consultant) => (
                        <TableRow key={consultant.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {consultant.full_name?.[0]?.toUpperCase() || "C"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{consultant.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal">
                              {consultant.job_title || "Consultor"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <CSGoalDialog
                              consultantId={consultant.id}
                              consultantName={consultant.full_name || "Consultor"}
                              currentMonth={formattedMonth}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {!consultants?.length && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            Nenhum consultor encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          )}

          {/* Tab: Dashboard */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="space-y-6">
              {/* Monthly Trend Chart - Full Width */}
              <MonthlyTrendChart year={selectedYear} />

              {/* Performance Ranking - Full Width */}
              <PerformanceRanking month={selectedMonth} year={selectedYear} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
