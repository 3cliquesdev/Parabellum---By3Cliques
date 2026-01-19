import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TutorialPanel } from "./TutorialPanel";
import { useTour } from "./TourProvider";

interface GlobalTourButtonProps {
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function GlobalTourButton({ position = "bottom-right" }: GlobalTourButtonProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const { isActive } = useTour();

  const positionClasses = {
    "bottom-right": "fixed bottom-4 right-4",
    "bottom-left": "fixed bottom-4 left-4",
    "top-right": "fixed top-20 right-4",
    "top-left": "fixed top-20 left-4",
  };

  // Hide button when tour is active
  if (isActive) return null;

  return (
    <>
      <div className={`${positionClasses[position]} z-40`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPanelOpen(true)}
                className="rounded-full shadow-lg bg-background hover:bg-accent border-2 h-12 w-12"
              >
                <HelpCircle className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Tutoriais e Ajuda</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <TutorialPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}
