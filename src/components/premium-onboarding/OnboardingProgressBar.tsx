import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
}

interface OnboardingProgressBarProps {
  steps: Step[];
  currentStep: number;
}

export function OnboardingProgressBar({
  steps,
  currentStep,
}: OnboardingProgressBarProps) {
  return (
    <div className="w-full py-4">
      {/* Mobile: Simple progress bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Passo {currentStep} de {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round((currentStep / steps.length) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          {steps[currentStep - 1]?.title}
        </p>
      </div>

      {/* Desktop: Step circles with lines */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" />
          
          {/* Progress line */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 ease-out"
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
          />

          {steps.map((step) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            const isPending = step.id > currentStep;

            return (
              <div
                key={step.id}
                className="flex flex-col items-center relative z-10"
              >
                {/* Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    "font-semibold text-sm border-2",
                    isCompleted &&
                      "bg-primary border-primary text-primary-foreground",
                    isCurrent &&
                      "bg-background border-primary text-primary shadow-lg shadow-primary/20",
                    isPending &&
                      "bg-muted border-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium text-center max-w-[80px] transition-colors",
                    isCurrent && "text-primary",
                    isCompleted && "text-foreground",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
