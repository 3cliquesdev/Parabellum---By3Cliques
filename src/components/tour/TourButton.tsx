import { useEffect, useState } from "react";
import { HelpCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTour, TourStep } from "./TourProvider";
import { useTourProgress } from "@/hooks/useTourProgress";

interface TourButtonProps {
  tourId: string;
  steps: TourStep[];
  autoStart?: boolean;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function TourButton({
  tourId,
  steps,
  autoStart = true,
  position = "bottom-right",
}: TourButtonProps) {
  const { startTour, isActive } = useTour();
  const { completed, isLoading, markComplete, resetTour } = useTourProgress(tourId);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Auto-start tour always (regardless of completion status)
  useEffect(() => {
    if (
      autoStart &&
      !isLoading &&
      !isActive &&
      !hasAutoStarted &&
      steps.length > 0
    ) {
      // Small delay to ensure DOM elements are rendered
      const timer = setTimeout(() => {
        startTour(steps, () => {
          markComplete();
        });
        setHasAutoStarted(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [autoStart, completed, isLoading, isActive, hasAutoStarted, steps, startTour, markComplete]);

  const positionClasses = {
    "bottom-right": "fixed bottom-4 right-4",
    "bottom-left": "fixed bottom-4 left-4",
    "top-right": "fixed top-20 right-4",
    "top-left": "fixed top-20 left-4",
  };

  const handleStartTour = () => {
    startTour(steps, () => {
      markComplete();
    });
  };

  const handleRestartTour = () => {
    resetTour();
    setTimeout(() => {
      startTour(steps, () => {
        markComplete();
      });
    }, 100);
  };

  if (isLoading || isActive) return null;

  return (
    <div className={`${positionClasses[position]} z-40`}>
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full shadow-lg bg-background hover:bg-accent border-2"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Ajuda e Tutorial</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleStartTour}>
              <HelpCircle className="h-4 w-4 mr-2" />
              {completed ? "Ver tutorial novamente" : "Iniciar tutorial"}
            </DropdownMenuItem>
            {completed && (
              <DropdownMenuItem onClick={handleRestartTour}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetar tutorial
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    </div>
  );
}
