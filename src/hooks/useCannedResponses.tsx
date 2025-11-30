import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CannedResponse {
  id: string;
  title: string;
  shortcut: string;
  content: string;
  department_id: string | null;
  created_by: string;
  is_public: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export function useCannedResponses(searchQuery?: string) {
  return useQuery({
    queryKey: ["canned_responses", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("canned_responses")
        .select("*")
        .order("usage_count", { ascending: false });

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,shortcut.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as CannedResponse[];
    },
  });
}

export function useCreateCannedResponse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CannedResponse, "id" | "created_at" | "updated_at" | "created_by" | "usage_count">) => {
      const { data: response, error } = await supabase
        .from("canned_responses")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned_responses"] });
      toast({
        title: "Macro criada",
        description: "Resposta pronta criada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar macro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCannedResponse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CannedResponse> & { id: string }) => {
      const { data, error } = await supabase
        .from("canned_responses")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned_responses"] });
      toast({
        title: "Macro atualizada",
        description: "Resposta pronta atualizada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar macro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCannedResponse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("canned_responses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned_responses"] });
      toast({
        title: "Macro excluída",
        description: "Resposta pronta excluída com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir macro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useIncrementMacroUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch current count
      const { data: current } = await supabase
        .from("canned_responses")
        .select("usage_count")
        .eq("id", id)
        .single();

      // Increment manually
      const { error } = await supabase
        .from("canned_responses")
        .update({ usage_count: (current?.usage_count || 0) + 1 })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned_responses"] });
    },
  });
}
