import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TeamSettings {
  id: string;
  team_id: string;
  department_id: string | null;
  max_concurrent_chats: number;
  auto_assign: boolean;
  created_at: string;
  updated_at: string;
  department?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export function useTeamSettings(teamId?: string) {
  return useQuery({
    queryKey: ["team-settings", teamId],
    queryFn: async () => {
      if (!teamId) return null;
      
      const { data, error } = await supabase
        .from("team_settings")
        .select(`
          *,
          department:departments(id, name, color)
        `)
        .eq("team_id", teamId)
        .maybeSingle();

      if (error) throw error;
      return data as TeamSettings | null;
    },
    enabled: !!teamId,
  });
}

export function useUpsertTeamSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      teamId, 
      departmentId, 
      maxConcurrentChats, 
      autoAssign 
    }: { 
      teamId: string; 
      departmentId?: string | null;
      maxConcurrentChats?: number;
      autoAssign?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("team_settings")
        .upsert({
          team_id: teamId,
          department_id: departmentId,
          max_concurrent_chats: maxConcurrentChats ?? 5,
          auto_assign: autoAssign ?? true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'team_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ["team-settings", teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast({ title: "Configurações salvas", description: "As configurações do time foram atualizadas." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar configurações", description: error.message, variant: "destructive" });
    },
  });
}
