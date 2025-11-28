import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuoteStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const steps = [
  { number: 1, title: "Produtos" },
  { number: 2, title: "Valores" },
  { number: 3, title: "Preview" },
];

export default function QuoteStepper({ currentStep, onStepClick }: QuoteStepperProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            {/* Step Circle */}
            <button
              type="button"
              onClick={() => onStepClick?.(step.number)}
              disabled={step.number > currentStep}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                step.number < currentStep && "bg-primary border-primary text-primary-foreground",
                step.number === currentStep && "border-primary text-primary bg-background",
                step.number > currentStep && "border-border text-muted-foreground bg-background",
                step.number <= currentStep && "cursor-pointer hover:scale-110",
                step.number > currentStep && "cursor-not-allowed"
              )}
            >
              {step.number < currentStep ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="font-semibold">{step.number}</span>
              )}
            </button>

            {/* Step Label */}
            <div className="ml-2 mr-4">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.number <= currentStep ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.title}
              </p>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-16 h-0.5 mx-2",
                  step.number < currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
