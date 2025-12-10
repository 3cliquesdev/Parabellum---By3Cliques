import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAdminOnboarding } from "@/hooks/useAdminOnboarding";
import { Rocket, ChevronRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingWidgetProps {
  className?: string;
}

export function OnboardingWidget({ className }: OnboardingWidgetProps) {
  const navigate = useNavigate();
  const { progress, isCompleted, isLoading, steps } = useAdminOnboarding();

  // Não mostrar se já completou
  if (isCompleted) return null;

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="h-4 bg-muted rounded w-3/4 mb-4" />
          <div className="h-2 bg-muted rounded w-full" />
        </CardContent>
      </Card>
    );
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;

  return (
    <Card className={cn("border-primary/20 bg-gradient-to-br from-primary/5 to-transparent", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Configure seu CRM
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completedSteps} de {totalSteps} etapas
            </span>
            <span className="font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <p className="text-sm text-muted-foreground">
          Complete a configuração para desbloquear todos os recursos.
        </p>

        <Button 
          onClick={() => navigate('/admin-onboarding')}
          className="w-full"
          variant="default"
        >
          <Rocket className="h-4 w-4 mr-2" />
          Continuar Onboarding
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>
      </CardContent>
    </Card>
  );
}
