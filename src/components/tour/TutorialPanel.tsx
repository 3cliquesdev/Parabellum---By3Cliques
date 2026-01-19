import { useNavigate, useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTour } from "./TourProvider";
import { useTourProgress } from "@/hooks/useTourProgress";
import { AVAILABLE_TUTORIALS, TutorialConfig } from "./tourConfig";
import { cn } from "@/lib/utils";

interface TutorialPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TutorialItem({ tutorial, onSelect }: { tutorial: TutorialConfig; onSelect: () => void }) {
  const { completed, markComplete } = useTourProgress(tutorial.id);
  const IconComponent = (LucideIcons as any)[tutorial.icon] || LucideIcons.HelpCircle;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
        "hover:bg-accent/50 border border-transparent hover:border-border",
        completed && "bg-muted/30"
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
        completed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}>
        <IconComponent className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{tutorial.title}</span>
          {completed && (
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {tutorial.description}
        </p>
      </div>
    </button>
  );
}

export function TutorialPanel({ open, onOpenChange }: TutorialPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { startTour } = useTour();

  const handleSelectTutorial = (tutorial: TutorialConfig) => {
    onOpenChange(false);

    // Find the tutorial's markComplete function
    const startTutorial = () => {
      setTimeout(() => {
        startTour(tutorial.steps, () => {
          // Tutorial completed - will be marked via the hook
        });
      }, 500);
    };

    // Navigate to the route if not already there
    if (location.pathname !== tutorial.route) {
      navigate(tutorial.route);
      // Wait for navigation to complete
      setTimeout(startTutorial, 300);
    } else {
      startTutorial();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <LucideIcons.GraduationCap className="h-6 w-6 text-primary" />
            Tutoriais Disponíveis
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-4 space-y-2">
            {AVAILABLE_TUTORIALS.map((tutorial) => (
              <TutorialItem
                key={tutorial.id}
                tutorial={tutorial}
                onSelect={() => handleSelectTutorial(tutorial)}
              />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
