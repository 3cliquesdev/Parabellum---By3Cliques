import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleBadge } from "./RoleBadge";
import { ProgressCell } from "./ProgressCell";
import { Save, Loader2, Trophy } from "lucide-react";
import { TeamMemberProgress } from "@/hooks/useTeamGoalProgress";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  full_name?: string | null;
  email?: string;
  role: string;
  avatar_url?: string | null;
}

interface GoalData {
  primary: string;
  secondary: string;
}

interface GoalsTableProps {
  users: User[];
  teamProgress: TeamMemberProgress[];
  getExistingGoal: (userId: string, role: string) => any;
  onSaveGoal: (userId: string, role: string, fullName: string, values: GoalData) => Promise<void>;
  isSaving: boolean;
}

export function GoalsTable({
  users,
  teamProgress,
  getExistingGoal,
  onSaveGoal,
  isSaving,
}: GoalsTableProps) {
  const [goalValues, setGoalValues] = useState<Record<string, GoalData>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const formatCurrency = (value: number | undefined) => {
    if (!value) return "";
    return value.toLocaleString('pt-BR');
  };

  const handleSave = async (user: User) => {
    setSavingUserId(user.id);
    const values = goalValues[user.id] || { primary: "", secondary: "" };
    
    // Get existing values if not changed
    const existing = getExistingGoal(user.id, user.role);
    const isSalesRep = user.role === "sales_rep";
    
    const finalValues = {
      primary: values.primary || (existing 
        ? isSalesRep 
          ? formatCurrency((existing as any).target_value)
          : formatCurrency((existing as any).target_gmv)
        : ""),
      secondary: values.secondary || (existing 
        ? isSalesRep 
          ? String((existing as any).commission_rate || "")
          : formatCurrency((existing as any).target_upsell)
        : ""),
    };
    
    await onSaveGoal(user.id, user.role, user.full_name || user.email, finalValues);
    setSavingUserId(null);
  };

  // Find top 3 performers
  const topPerformerIds = teamProgress
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3)
    .map(m => m.id);

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Colaborador</TableHead>
            <TableHead className="font-semibold">Cargo</TableHead>
            <TableHead className="font-semibold">Meta Principal</TableHead>
            <TableHead className="font-semibold">Progresso</TableHead>
            <TableHead className="font-semibold">Meta Secundária</TableHead>
            <TableHead className="text-right font-semibold">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user, index) => {
            const existing = getExistingGoal(user.id, user.role);
            const isSalesRep = user.role === "sales_rep";
            const memberProgress = teamProgress.find(m => m.id === user.id);
            const isTopPerformer = topPerformerIds.includes(user.id);
            const rankIndex = topPerformerIds.indexOf(user.id);

            return (
              <TableRow 
                key={user.id} 
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  memberProgress?.percentage && memberProgress.percentage >= 100 && "bg-green-50/50 dark:bg-green-900/10"
                )}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className={cn(
                        "h-10 w-10",
                        isTopPerformer && rankIndex === 0 && "ring-2 ring-amber-500",
                        isTopPerformer && rankIndex === 1 && "ring-2 ring-gray-400",
                        isTopPerformer && rankIndex === 2 && "ring-2 ring-amber-700"
                      )}>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {user.full_name?.[0] || user.email?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {isTopPerformer && (
                        <div className={cn(
                          "absolute -top-1 -right-1 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center text-white",
                          rankIndex === 0 && "bg-amber-500",
                          rankIndex === 1 && "bg-gray-400",
                          rankIndex === 2 && "bg-amber-700"
                        )}>
                          {rankIndex + 1}º
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground flex items-center gap-2">
                        {user.full_name || user.email}
                        {memberProgress?.percentage && memberProgress.percentage >= 100 && (
                          <Trophy className="h-4 w-4 text-amber-500" />
                        )}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">
                      {isSalesRep ? "Meta de Vendas (R$)" : "Meta de GMV (R$)"}
                    </label>
                    <Input
                      type="text"
                      placeholder="R$ 0,00"
                      defaultValue={
                        existing 
                          ? isSalesRep 
                            ? formatCurrency((existing as any).target_value) 
                            : formatCurrency((existing as any).target_gmv)
                          : ""
                      }
                      onChange={(e) => setGoalValues(prev => ({
                        ...prev,
                        [user.id]: { ...prev[user.id], primary: e.target.value }
                      }))}
                      className="w-40 font-medium"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  {memberProgress ? (
                    <ProgressCell
                      percentage={memberProgress.percentage}
                      currentValue={memberProgress.currentValue}
                      targetValue={memberProgress.targetValue}
                      isTopPerformer={isTopPerformer && rankIndex < 3}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Sem meta definida
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">
                      {isSalesRep ? "Comissão (%)" : "Meta Upsell (R$)"}
                    </label>
                    <Input
                      type="text"
                      placeholder={isSalesRep ? "0%" : "R$ 0,00"}
                      defaultValue={
                        existing 
                          ? isSalesRep 
                            ? (existing as any).commission_rate || "" 
                            : formatCurrency((existing as any).target_upsell)
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
                    onClick={() => handleSave(user)}
                    disabled={isSaving || savingUserId === user.id}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {savingUserId === user.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
