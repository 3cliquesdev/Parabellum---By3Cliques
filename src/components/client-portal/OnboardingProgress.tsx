import { useClientOnboarding, OnboardingStep } from "@/hooks/useClientOnboarding";
import { CheckCircle2, Circle, Lock, FileText, Clock, PartyPopper, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingProgress() {
  const { executions, isLoading, error } = useClientOnboarding();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-gray-500 text-sm">Carregando onboarding...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 text-sm">Erro ao carregar onboarding.</p>
      </div>
    );
  }

  if (!executions || executions.length === 0) {
    return (
      <div className="text-center py-10">
        <PartyPopper className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Seu onboarding está completo! 🎉
        </h3>
        <p className="text-gray-500 text-sm">
          Nenhum onboarding ativo no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {executions.map((exec) => {
        const firstPendingIndex = exec.steps.findIndex((s) => !s.completed);

        return (
          <div key={exec.id}>
            {/* Header com progresso */}
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {exec.playbook_name}
              </h3>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span>
                  {exec.completedCount} de {exec.totalCount} etapas concluídas
                </span>
                <span className="font-bold text-blue-600">{exec.progress}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    exec.progress === 100
                      ? "bg-gradient-to-r from-green-500 to-emerald-500"
                      : "bg-gradient-to-r from-blue-500 to-blue-600"
                  }`}
                  style={{ width: `${exec.progress}%` }}
                />
              </div>
            </div>

            {/* Checklist vertical */}
            <div className="space-y-0">
              {exec.steps.map((step, index) => (
                <StepItem
                  key={step.id}
                  step={step}
                  isCurrent={index === firstPendingIndex}
                  isFuture={index > firstPendingIndex && firstPendingIndex !== -1}
                  isLast={index === exec.steps.length - 1}
                  executionId={exec.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepItem({
  step,
  isCurrent,
  isFuture,
  isLast,
  executionId,
}: {
  step: OnboardingStep;
  isCurrent: boolean;
  isFuture: boolean;
  isLast: boolean;
  executionId: string;
}) {
  const isCompleted = step.completed;

  return (
    <div className="flex gap-3">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center">
        <div className="flex-shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          ) : isCurrent ? (
            <Circle className="h-6 w-6 text-blue-500 fill-blue-100" />
          ) : (
            <Lock className="h-5 w-5 text-gray-300 mt-0.5" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[24px] ${
              isCompleted ? "bg-green-300" : "bg-gray-200"
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 pb-4 ${
          isCompleted
            ? "opacity-70"
            : isCurrent
            ? ""
            : "opacity-40"
        }`}
      >
        <div
          className={`rounded-lg p-3 ${
            isCurrent
              ? "bg-blue-50 border border-blue-200"
              : isCompleted
              ? "bg-green-50 border border-green-100"
              : "bg-gray-50 border border-gray-100"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              isCompleted
                ? "text-green-700 line-through"
                : isCurrent
                ? "text-blue-700"
                : "text-gray-400"
            }`}
          >
            {step.name}
          </p>

          {step.description && (
            <p
              className={`text-xs mt-0.5 ${
                isCompleted
                  ? "text-green-600"
                  : isCurrent
                  ? "text-blue-600"
                  : "text-gray-400"
              }`}
            >
              {step.description}
            </p>
          )}

          {/* Actions for current step */}
          {isCurrent && step.step_type === "form" && step.form_id && (
            <Button
              size="sm"
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              asChild
            >
              <a
                href={`/public-onboarding/${executionId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Preencher agora →
              </a>
            </Button>
          )}

          {isCurrent && step.step_type === "task" && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-500">
              <Clock className="h-3.5 w-3.5" />
              Em processamento pela equipe
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
