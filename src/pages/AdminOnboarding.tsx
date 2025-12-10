import { useState } from "react";
import Layout from "@/components/Layout";
import { useAdminOnboarding } from "@/hooks/useAdminOnboarding";
import { ONBOARDING_STEPS } from "@/lib/onboarding-engine";
import { OnboardingHeader } from "@/components/admin-onboarding/OnboardingHeader";
import { OnboardingStepCard } from "@/components/admin-onboarding/OnboardingStepCard";
import { OnboardingProgress } from "@/components/admin-onboarding/OnboardingProgress";
import { OnboardingComplete } from "@/components/admin-onboarding/OnboardingComplete";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, HelpCircle } from "lucide-react";

export default function AdminOnboarding() {
  const {
    steps,
    progress,
    isCompleted,
    completedAt,
    isLoading,
    isValidating,
    validateStepAuto,
    validateAllSteps,
    skipStep,
    resetOnboarding,
    getStepStatus,
  } = useAdminOnboarding();

  const [expandedStep, setExpandedStep] = useState<string | null>(
    ONBOARDING_STEPS[0]?.key || null
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <div className="space-y-4 mt-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="grid gap-8 lg:grid-cols-[1fr_200px]">
          {/* Main Content */}
          <div className="space-y-6">
            <OnboardingHeader
              progress={progress}
              isValidating={isValidating}
              onValidateAll={async () => {
                await validateAllSteps();
              }}
              onReset={resetOnboarding}
            />

            {/* Completed State */}
            {isCompleted ? (
              <OnboardingComplete completedAt={completedAt} />
            ) : (
              /* Steps List */
              <div className="space-y-3">
                {ONBOARDING_STEPS.map((step, index) => (
                  <OnboardingStepCard
                    key={step.key}
                    stepNumber={index + 1}
                    title={step.title}
                    description={step.description}
                    icon={step.icon}
                    route={step.route}
                    status={getStepStatus(step.key)}
                    onValidate={() => validateStepAuto(step.key)}
                    onSkip={() => skipStep(step.key)}
                    isExpanded={expandedStep === step.key}
                    onToggle={() => 
                      setExpandedStep(expandedStep === step.key ? null : step.key)
                    }
                  />
                ))}
              </div>
            )}

            {/* Tips Card */}
            {!isCompleted && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Dica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Você pode completar as etapas em qualquer ordem. O sistema 
                    validará automaticamente quando detectar que a configuração 
                    foi realizada. Clique em "Validar" para verificar manualmente.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Progress Circle */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <OnboardingProgress 
                progress={progress} 
                isValidating={isValidating}
              />
              
              <div className="text-center text-sm text-muted-foreground">
                {steps.filter(s => s.status === 'completed').length} de{" "}
                {ONBOARDING_STEPS.length} etapas
              </div>

              {!isCompleted && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Complete o onboarding para desbloquear todos os recursos do CRM.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
