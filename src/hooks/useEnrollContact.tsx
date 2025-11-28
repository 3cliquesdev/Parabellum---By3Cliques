import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EnrollContactData {
  contact_id: string;
  cadence_id: string;
  start_immediately?: boolean;
}

export function useEnrollContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ contact_id, cadence_id, start_immediately = true }: EnrollContactData) => {
      // Get first step to calculate next_step_at
      const { data: steps, error: stepsError } = await supabase
        .from("cadence_steps")
        .select("day_offset")
        .eq("cadence_id", cadence_id)
        .order("position", { ascending: true })
        .limit(1)
        .single();

      if (stepsError) throw stepsError;

      const nextStepDate = new Date();
      nextStepDate.setDate(nextStepDate.getDate() + (steps?.day_offset || 0));

      const { data: enrollment, error } = await supabase
        .from("cadence_enrollments")
        .insert({
          contact_id,
          cadence_id,
          status: "active",
          current_step: 0,
          next_step_at: start_immediately ? nextStepDate.toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return enrollment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadence-enrollments"] });
      toast({
        title: "Contato inscrito na cadência",
        description: "O contato foi adicionado à cadência com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao inscrever contato",
        description: error.message,
      });
    },
  });
}
