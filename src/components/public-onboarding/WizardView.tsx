import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WizardProgress } from "./WizardProgress";
import { OnboardingStepCard } from "./OnboardingStepCard";
import { CelebrationView } from "./CelebrationView";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface Step {
  id: string;
  step_name: string;
  position: number;
  completed: boolean;
  is_critical: boolean;
  video_url?: string;
  rich_content?: string;
  quiz_enabled?: boolean;
  quiz_question?: string;
  quiz_options?: any;
  quiz_correct_option?: string;
  quiz_passed?: boolean;
  attachments?: any;
}

interface WizardViewProps {
  steps: Step[];
  customerName: string;
  contactId: string;
  supportPhone: string;
  onRefresh: () => void;
}

export function WizardView({ steps, customerName, contactId, supportPhone, onRefresh }: WizardViewProps) {
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [localSteps, setLocalSteps] = useState<Step[]>(steps);
  const [isCompleted, setIsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Find first incomplete step
    const firstIncompleteIndex = steps.findIndex(s => !s.completed);
    if (firstIncompleteIndex >= 0) {
      setCurrentStepIndex(firstIncompleteIndex);
    } else if (steps.length > 0) {
      // All completed, show celebration
      setIsCompleted(true);
    }
    setLocalSteps(steps);
  }, [steps]);

  const currentStep = localSteps[currentStepIndex];
  const totalSteps = localSteps.length;
  const completedSteps = localSteps.filter(s => s.completed).length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleNext = async () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Last step - check if all completed
      if (localSteps.every(s => s.completed)) {
        triggerCelebration();
        setIsCompleted(true);
      }
    }
  };

  const handleStepComplete = async (stepId: string, completed: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_journey_steps")
        .update({ 
          completed, 
          completed_at: completed ? new Date().toISOString() : null 
        })
        .eq("id", stepId);

      if (error) throw error;

      // Update local state
      setLocalSteps(prev => 
        prev.map(s => s.id === stepId ? { ...s, completed } : s)
      );

      if (completed) {
        toast({
          title: "Etapa concluída! ✅",
          description: "Seu progresso foi salvo automaticamente.",
        });
      }
    } catch (err) {
      console.error("Error updating step:", err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar seu progresso. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuizPass = async (stepId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_journey_steps")
        .update({ 
          quiz_passed: true,
          quiz_passed_at: new Date().toISOString(),
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", stepId);

      if (error) throw error;

      setLocalSteps(prev => 
        prev.map(s => s.id === stepId ? { ...s, quiz_passed: true, completed: true } : s)
      );

      toast({
        title: "Parabéns! 🎉",
        description: "Você acertou o quiz e completou esta etapa!",
      });
    } catch (err) {
      console.error("Error updating quiz:", err);
    } finally {
      setSaving(false);
    }
  };

  const triggerCelebration = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => 
      Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#2563EB", "#10B981", "#F59E0B"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#2563EB", "#10B981", "#F59E0B"],
      });
    }, 150);
  };

  if (isCompleted) {
    return (
      <CelebrationView
        customerName={customerName}
        supportPhone={supportPhone}
      />
    );
  }

  if (!currentStep) {
    return null;
  }

  const canGoNext = currentStep.completed || 
    (!currentStep.is_critical && !currentStep.quiz_enabled);

  return (
    <div className="min-h-screen flex flex-col py-8 px-4">
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col">
        {/* Header with Progress */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Seu Progresso
              </h2>
              <span className="text-sm font-medium text-primary">
                {completedSteps} de {totalSteps} etapas
              </span>
            </div>
            
            <Progress value={progressPercentage} className="h-3 mb-4" />
            
            <WizardProgress
              steps={localSteps}
              currentIndex={currentStepIndex}
              onStepClick={setCurrentStepIndex}
            />
          </div>
        </motion.div>

        {/* Step Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <OnboardingStepCard
                step={currentStep}
                stepNumber={currentStepIndex + 1}
                totalSteps={totalSteps}
                onComplete={(completed) => handleStepComplete(currentStep.id, completed)}
                onQuizPass={() => handleQuizPass(currentStep.id)}
                supportPhone={supportPhone}
                customerName={customerName}
                saving={saving}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStepIndex === 0}
                className="flex-1 sm:flex-none"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>

              <span className="hidden sm:inline text-sm text-muted-foreground">
                Etapa {currentStepIndex + 1} de {totalSteps}
              </span>

              {currentStepIndex < totalSteps - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-blue-600"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!localSteps.every(s => s.completed)}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-500 to-emerald-600"
                >
                  <PartyPopper className="w-4 h-4 mr-2" />
                  Concluir
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
