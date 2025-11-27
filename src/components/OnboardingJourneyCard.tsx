import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertCircle, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCustomerContext } from "@/hooks/useCustomerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStepModal } from "@/components/OnboardingStepModal";

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
      </CardHeader>
      <CardContent className="space-y-4">
        {context.journeySteps.map((step) => (
          <div
            key={step.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => setSelectedStep(step)}
          >
            {step.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium ${step.completed ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.step_name}
                </span>
                {step.is_critical && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Crítica
                  </Badge>
                )}
                {step.video_url && (
                  <Badge variant="outline" className="gap-1">
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
        ))}
      </CardContent>

      {/* Modal */}
      {selectedStep && (
        <OnboardingStepModal
          step={selectedStep}
          onClose={() => setSelectedStep(null)}
        />
      )}
    </Card>
  );
}
