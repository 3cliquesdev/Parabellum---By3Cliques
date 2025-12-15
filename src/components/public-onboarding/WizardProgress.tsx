import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";

interface Step {
  id: string;
  step_name: string;
  completed: boolean;
}

interface WizardProgressProps {
  steps: Step[];
  currentIndex: number;
  onStepClick: (index: number) => void;
}

export function WizardProgress({ steps, currentIndex, onStepClick }: WizardProgressProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
      {steps.map((step, index) => {
        const isCompleted = step.completed;
        const isCurrent = index === currentIndex;
        const isClickable = index <= currentIndex || steps[index - 1]?.completed;
        
        return (
          <button
            key={step.id}
            onClick={() => isClickable && onStepClick(index)}
            disabled={!isClickable}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
              ${isCompleted 
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" 
                : isCurrent 
                  ? "bg-primary/10 text-primary ring-2 ring-primary/30" 
                  : "bg-muted text-muted-foreground"
              }
              ${isClickable ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-50"}
            `}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px]">
                {index + 1}
              </span>
            )}
            <span className="hidden sm:inline max-w-[100px] truncate">
              {step.step_name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
