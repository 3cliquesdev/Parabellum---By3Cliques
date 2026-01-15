import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
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
  startTour: (steps: TourStep[], onComplete?: () => void) => void;
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

const TOOLTIP_HEIGHT = 220; // Estimated height of tooltip
const TOOLTIP_WIDTH = 320;
const PADDING = 16;

export function TourProvider({ children }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [onCompleteCallback, setOnCompleteCallback] = useState<(() => void) | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const startTour = useCallback((tourSteps: TourStep[], onComplete?: () => void) => {
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
    setOnCompleteCallback(() => onComplete || null);
  }, []);

  const endTour = useCallback(() => {
    if (onCompleteCallback) {
      onCompleteCallback();
    }
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
    setTargetRect(null);
    setTooltipPosition(null);
    setOnCompleteCallback(null);
  }, [onCompleteCallback]);

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

  // Calculate tooltip position based on available space
  const calculateTooltipPosition = useCallback((rect: DOMRect) => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    let top: number;
    let left: number;
    
    // Decide if tooltip goes below or above
    if (spaceBelow >= TOOLTIP_HEIGHT + PADDING) {
      // Place below
      top = rect.bottom + PADDING;
    } else if (spaceAbove >= TOOLTIP_HEIGHT + PADDING) {
      // Place above
      top = rect.top - TOOLTIP_HEIGHT - PADDING;
    } else {
      // Default to wherever there's more space, clamped
      if (spaceBelow >= spaceAbove) {
        top = rect.bottom + PADDING;
      } else {
        top = rect.top - TOOLTIP_HEIGHT - PADDING;
      }
    }
    
    // Clamp top to viewport
    top = Math.max(PADDING, Math.min(top, viewportHeight - TOOLTIP_HEIGHT - PADDING));
    
    // Calculate left position - try to align with target, but keep in viewport
    left = rect.left;
    left = Math.max(PADDING, Math.min(left, viewportWidth - TOOLTIP_WIDTH - PADDING));
    
    return { top, left };
  }, []);

  // Update target element position
  useEffect(() => {
    if (!isActive || steps.length === 0) {
      setTargetRect(null);
      setTooltipPosition(null);
      return;
    }

    let attempts = 0;
    const maxAttempts = 15;
    let retryInterval: NodeJS.Timeout | null = null;

    const updatePosition = () => {
      const step = steps[currentStep];
      if (!step) return false;

      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        setTooltipPosition(calculateTooltipPosition(rect));
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };

    // Try immediately
    if (updatePosition()) {
      return;
    }

    // Retry finding element with interval
    retryInterval = setInterval(() => {
      attempts++;
      if (updatePosition()) {
        if (retryInterval) clearInterval(retryInterval);
      } else if (attempts >= maxAttempts) {
        console.warn(`Tour: Element not found after ${maxAttempts} attempts: ${steps[currentStep]?.target}`);
        if (retryInterval) clearInterval(retryInterval);
        // Auto-skip to next step if element not found
        if (currentStep < steps.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          endTour();
        }
      }
    }, 100);

    const handleResize = () => {
      if (targetRect) {
        const step = steps[currentStep];
        if (step) {
          const element = document.querySelector(step.target);
          if (element) {
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);
            setTooltipPosition(calculateTooltipPosition(rect));
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      if (retryInterval) clearInterval(retryInterval);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isActive, currentStep, steps, endTour, calculateTooltipPosition]);

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

      {/* Tour Overlay - Only render when we have a valid target AND tooltip position */}
      {isActive && targetRect && tooltipPosition && currentTourStep && createPortal(
        <>
          {/* Spotlight with box-shadow overlay */}
          <div
            className="fixed z-[9998] pointer-events-none rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
            }}
          />

          {/* Tooltip */}
          <Card
            ref={tooltipRef}
            className="fixed z-[10000] w-80 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2 bg-card border-border"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
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
