import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface OnboardingProgressProps {
  progress: number;
  isValidating?: boolean;
  className?: string;
}

export function OnboardingProgress({ 
  progress, 
  isValidating = false,
  className 
}: OnboardingProgressProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Background circle */}
      <svg className="w-32 h-32 transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-500 ease-out",
            progress === 100 ? "text-green-500" : "text-primary"
          )}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isValidating ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : progress === 100 ? (
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        ) : (
          <span className="text-2xl font-bold text-foreground">{progress}%</span>
        )}
        <span className="text-xs text-muted-foreground mt-1">
          {progress === 100 ? "Concluído" : "Progresso"}
        </span>
      </div>
    </div>
  );
}

interface OnboardingProgressBarProps {
  progress: number;
  className?: string;
}

export function OnboardingProgressBar({ progress, className }: OnboardingProgressBarProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-foreground">
          Progresso do Onboarding
        </span>
        <span className="text-sm font-bold text-primary">{progress}%</span>
      </div>
      <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            progress === 100 
              ? "bg-gradient-to-r from-green-500 to-emerald-500" 
              : "bg-gradient-to-r from-primary to-primary/80"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
