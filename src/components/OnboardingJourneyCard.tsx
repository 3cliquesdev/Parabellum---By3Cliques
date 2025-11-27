import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Play, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCustomerContext } from "@/hooks/useCustomerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStepModal } from "@/components/OnboardingStepModal";
import { cn } from "@/lib/utils";

interface OnboardingJourneyCardProps {
  contactId: string;
}

export default function OnboardingJourneyCard({ contactId }: OnboardingJourneyCardProps) {
  const { data: context, isLoading } = useCustomerContext(contactId);
  const [selectedStep, setSelectedStep] = useState<any | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!context?.journeySteps || context.journeySteps.length === 0) {
    return null;
  }

  const totalSteps = context.journeySteps.length;
  const completedSteps = context.journeySteps.filter(s => s.completed).length;
  const progress = Math.round((completedSteps / totalSteps) * 100);
  const firstIncompleteStep = context.journeySteps.find(s => !s.completed);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Jornada de Onboarding</CardTitle>
          <Badge variant={progress === 100 ? "default" : "secondary"}>
            {completedSteps}/{totalSteps} etapas
          </Badge>
        </div>
        <Progress value={progress} className="mt-2" />
        
        {firstIncompleteStep && (
          <Button 
            onClick={() => setSelectedStep(firstIncompleteStep)}
            className="mt-4 w-full gap-2"
          >
            <Play className="h-4 w-4" />
            Continuar: {firstIncompleteStep.step_name}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {context.journeySteps.map((step, index) => {
          const isCompleted = step.completed;
          const isCurrent = !isCompleted && index === context.journeySteps.findIndex(s => !s.completed);
          const isLocked = !isCompleted && !isCurrent;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                isCompleted && "bg-green-50 border-green-200 dark:bg-green-950/30",
                isCurrent && "bg-primary/10 border-primary ring-2 ring-primary/20",
                isLocked && "opacity-60",
                !isLocked && "cursor-pointer hover:bg-accent/50"
              )}
              onClick={() => !isLocked && setSelectedStep(step)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : isCurrent ? (
                  <Play className="h-5 w-5 text-primary animate-pulse" />
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {step.step_name}
                  </span>
                  
                  {isCompleted && (
                    <Badge className="bg-green-500 text-white text-xs">
                      ✅ Concluída
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge className="bg-primary text-white text-xs animate-pulse">
                      ▶️ Atual
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      🔒 Bloqueada
                    </Badge>
                  )}
                  
                  {step.is_critical && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Crítica
                    </Badge>
                  )}
                  {step.video_url && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Play className="h-3 w-3" />
                      Vídeo
                    </Badge>
                  )}
                </div>

              {step.completed && step.completed_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {step.completed_by_profile && (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={step.completed_by_profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {step.completed_by_profile.full_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{step.completed_by_profile.full_name}</span>
                    </div>
                  )}
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(step.completed_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              )}

                {step.notes && (
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {step.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {selectedStep && (
        <OnboardingStepModal
          step={selectedStep}
          onClose={() => setSelectedStep(null)}
          allSteps={context.journeySteps as any}
          onNavigateToStep={setSelectedStep}
        />
      )}
    </Card>
  );
}
