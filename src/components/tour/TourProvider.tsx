import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTour: (steps: TourStep[]) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
}

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const startTour = useCallback((tourSteps: TourStep[]) => {
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
    setTargetRect(null);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour();
    }
  }, [currentStep, steps.length, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStep(index);
    }
  }, [steps.length]);

  // Update target element position
  useEffect(() => {
    if (!isActive || steps.length === 0) return;

    const updatePosition = () => {
      const step = steps[currentStep];
      if (!step) return;

      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isActive, currentStep, steps]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          endTour();
          break;
        case 'ArrowRight':
          nextStep();
          break;
        case 'ArrowLeft':
          prevStep();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, endTour]);

  const currentTourStep = steps[currentStep];

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: steps.length,
        startTour,
        endTour,
        nextStep,
        prevStep,
        goToStep,
      }}
    >
      {children}

      {/* Tour Overlay */}
      {isActive && createPortal(
        <>
          {/* Dark overlay with cutout */}
          <div 
            className="fixed inset-0 z-[9998] pointer-events-none"
            style={{
              background: targetRect 
                ? `radial-gradient(ellipse at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 2 + 20}px, rgba(0,0,0,0.7) ${Math.max(targetRect.width, targetRect.height) / 2 + 40}px)`
                : 'rgba(0,0,0,0.7)',
            }}
          />

          {/* Spotlight border */}
          {targetRect && (
            <div
              className="fixed z-[9999] pointer-events-none rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              style={{
                top: targetRect.top - 8,
                left: targetRect.left - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
            />
          )}

          {/* Tooltip */}
          {currentTourStep && targetRect && (
            <Card
              className="fixed z-[10000] w-80 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2"
              style={{
                top: targetRect.bottom + 16,
                left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 336)),
              }}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-foreground">
                    {currentTourStep.title}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -mt-1 -mr-1"
                    onClick={endTour}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {currentTourStep.content}
                </p>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1 mb-4">
                  {steps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToStep(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        index === currentStep
                          ? "bg-primary"
                          : "bg-muted hover:bg-muted-foreground/50"
                      )}
                    />
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevStep}
                    disabled={currentStep === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>

                  <span className="text-xs text-muted-foreground">
                    {currentStep + 1} / {steps.length}
                  </span>

                  <Button
                    size="sm"
                    onClick={nextStep}
                  >
                    {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>,
        document.body
      )}
    </TourContext.Provider>
  );
}

// Predefined tour steps
export const MAIN_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: 'Menu Principal',
    content: 'Este é o menu de navegação principal. Aqui você acessa todas as áreas do CRM.',
  },
  {
    target: '[data-tour="inbox"]',
    title: 'Inbox de Conversas',
    content: 'Gerencie todas as conversas com clientes em um só lugar. WhatsApp, Web Chat e mais.',
  },
  {
    target: '[data-tour="deals"]',
    title: 'Pipeline de Vendas',
    content: 'Visualize e gerencie seu funil de vendas no estilo Kanban.',
  },
  {
    target: '[data-tour="contacts"]',
    title: 'Base de Contatos',
    content: 'Acesse todos os seus clientes e leads com informações completas.',
  },
  {
    target: '[data-tour="support"]',
    title: 'Suporte e Tickets',
    content: 'Gerencie tickets de suporte e acompanhe a resolução de problemas.',
  },
  {
    target: '[data-tour="analytics"]',
    title: 'Analytics',
    content: 'Visualize métricas e KPIs do seu negócio em tempo real.',
  },
];
