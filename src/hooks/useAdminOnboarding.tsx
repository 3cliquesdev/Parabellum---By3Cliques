import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  ONBOARDING_STEPS, 
  validateStep, 
  calculateProgress,
  OnboardingStepProgress,
  OnboardingStepStatus
} from "@/lib/onboarding-engine";
import { toast } from "sonner";

export interface AdminOnboardingState {
  steps: OnboardingStepProgress[];
  progress: number;
  isCompleted: boolean;
  completedAt: string | null;
  currentStepKey: string | null;
}

export function useAdminOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = useState(false);

  // Buscar progresso do onboarding
  const { data: onboardingState, isLoading, refetch } = useQuery({
    queryKey: ["admin-onboarding", user?.id],
    queryFn: async (): Promise<AdminOnboardingState> => {
      if (!user?.id) {
        return {
          steps: [],
          progress: 0,
          isCompleted: false,
          completedAt: null,
          currentStepKey: ONBOARDING_STEPS[0].key,
        };
      }

      // Buscar steps salvos
      const { data: savedSteps, error } = await supabase
        .from('admin_onboarding_steps')
        .select('step_key, status, completed_at, validated_by')
        .eq('user_id', user.id);

      if (error) {
        console.error("Error fetching onboarding steps:", error);
        throw error;
      }

      // Mapear todos os steps com status
      const stepsMap = new Map(savedSteps?.map(s => [s.step_key, s]) || []);
      
      const steps: OnboardingStepProgress[] = ONBOARDING_STEPS.map(step => {
        const saved = stepsMap.get(step.key);
        return {
          step_key: step.key,
          status: (saved?.status as OnboardingStepStatus) || 'pending',
          completed_at: saved?.completed_at || null,
          validated_by: saved?.validated_by as 'auto' | 'manual' | 'ai' | null || null,
        };
      });

      const completedCount = steps.filter(s => s.status === 'completed').length;
      const progress = calculateProgress(completedCount);
      const isCompleted = progress === 100;

      // Encontrar próximo step pendente
      const currentStepKey = steps.find(s => s.status !== 'completed')?.step_key || null;

      return {
        steps,
        progress,
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null,
        currentStepKey,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Mutation para atualizar status de step
  const updateStepMutation = useMutation({
    mutationFn: async ({ 
      stepKey, 
      status, 
      validatedBy = 'manual' 
    }: { 
      stepKey: string; 
      status: OnboardingStepStatus; 
      validatedBy?: 'auto' | 'manual' | 'ai';
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error } = await supabase
        .from('admin_onboarding_steps')
        .upsert({
          user_id: user.id,
          step_key: stepKey,
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          validated_by: status === 'completed' ? validatedBy : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,step_key',
        });

      if (error) throw error;

      // Recalcular progresso
      await supabase.rpc('calculate_onboarding_progress', { p_user_id: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-onboarding"] });
    },
    onError: (error) => {
      console.error("Error updating step:", error);
      toast.error("Erro ao atualizar etapa");
    },
  });

  // Validar automaticamente uma etapa
  const validateStepAuto = useCallback(async (stepKey: string): Promise<boolean> => {
    setIsValidating(true);
    try {
      const isValid = await validateStep(stepKey);
      
      if (isValid) {
        await updateStepMutation.mutateAsync({
          stepKey,
          status: 'completed',
          validatedBy: 'auto',
        });
        toast.success("Etapa validada automaticamente!");
      }
      
      return isValid;
    } catch (error) {
      console.error("Error validating step:", error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [updateStepMutation]);

  // Validar todas as etapas
  const validateAllSteps = useCallback(async () => {
    setIsValidating(true);
    let validatedCount = 0;

    for (const step of ONBOARDING_STEPS) {
      const currentStatus = onboardingState?.steps.find(s => s.step_key === step.key)?.status;
      
      if (currentStatus !== 'completed') {
        const isValid = await validateStep(step.key);
        if (isValid) {
          await updateStepMutation.mutateAsync({
            stepKey: step.key,
            status: 'completed',
            validatedBy: 'auto',
          });
          validatedCount++;
        }
      }
    }

    setIsValidating(false);
    
    if (validatedCount > 0) {
      toast.success(`${validatedCount} etapa(s) validada(s) automaticamente!`);
    }
    
    return validatedCount;
  }, [onboardingState?.steps, updateStepMutation]);

  // Marcar etapa como concluída manualmente
  const completeStep = useCallback(async (stepKey: string) => {
    await updateStepMutation.mutateAsync({
      stepKey,
      status: 'completed',
      validatedBy: 'manual',
    });
    toast.success("Etapa marcada como concluída!");
  }, [updateStepMutation]);

  // Pular etapa
  const skipStep = useCallback(async (stepKey: string) => {
    await updateStepMutation.mutateAsync({
      stepKey,
      status: 'skipped',
    });
    toast.info("Etapa pulada");
  }, [updateStepMutation]);

  // Resetar onboarding
  const resetOnboarding = useCallback(async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('admin_onboarding_steps')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      toast.error("Erro ao resetar onboarding");
      return;
    }

    await supabase
      .from('profiles')
      .update({
        onboarding_completed: false,
        onboarding_completed_at: null,
        onboarding_progress: 0,
      })
      .eq('id', user.id);

    queryClient.invalidateQueries({ queryKey: ["admin-onboarding"] });
    toast.success("Onboarding resetado!");
  }, [user?.id, queryClient]);

  // Obter status de uma etapa específica
  const getStepStatus = useCallback((stepKey: string): OnboardingStepStatus => {
    return onboardingState?.steps.find(s => s.step_key === stepKey)?.status || 'pending';
  }, [onboardingState?.steps]);

  return {
    // Estado
    steps: onboardingState?.steps || [],
    progress: onboardingState?.progress || 0,
    isCompleted: onboardingState?.isCompleted || false,
    completedAt: onboardingState?.completedAt || null,
    currentStepKey: onboardingState?.currentStepKey || null,
    isLoading,
    isValidating,

    // Ações
    validateStepAuto,
    validateAllSteps,
    completeStep,
    skipStep,
    resetOnboarding,
    getStepStatus,
    refetch,
  };
}
