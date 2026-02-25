import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ChatFlow {
  id: string;
  name: string;
  description: string | null;
  triggers: string[];
  trigger_keywords: string[];
  department_id: string | null;
  support_channel_id: string | null;
  flow_definition: { nodes: any[]; edges: any[] };
  is_active: boolean;
  is_master_flow: boolean;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useChatFlows() {
  return useQuery({
    queryKey: ["chat-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_flows")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ChatFlow[];
    },
  });
}

export function useChatFlow(id: string | null) {
  return useQuery({
    queryKey: ["chat-flow", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("chat_flows")
        .select("id, name, description, triggers, trigger_keywords, department_id, support_channel_id, flow_definition, is_active, is_master_flow, priority, created_by, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as ChatFlow | null;
    },
    enabled: !!id,
    retry: 2,
    retryDelay: 1000,
  });
}

interface CreateChatFlowData {
  name: string;
  description?: string;
  triggers?: string[];
  trigger_keywords?: string[];
  department_id?: string;
  flow_definition: { nodes: any[]; edges: any[] };
  is_active?: boolean;
}

export function useCreateChatFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateChatFlowData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("chat_flows")
        .insert({
          ...data,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-flows"] });
      toast({
        title: "Fluxo criado",
        description: "O fluxo de chat foi criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateChatFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateChatFlowData>) => {
      const { data: result, error } = await supabase
        .from("chat_flows")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chat-flows"] });
      queryClient.invalidateQueries({ queryKey: ["chat-flow", variables.id] });
      toast({
        title: "Fluxo atualizado",
        description: "O fluxo de chat foi atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteChatFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chat_flows")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-flows"] });
      toast({
        title: "Fluxo excluído",
        description: "O fluxo de chat foi excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useToggleChatFlowActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("chat_flows")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chat-flows"] });
      toast({
        title: variables.is_active ? "Fluxo ativado" : "Fluxo desativado",
        description: `O fluxo foi ${variables.is_active ? "ativado" : "desativado"} com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDuplicateChatFlow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (flow: ChatFlow) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("chat_flows")
        .insert({
          name: `${flow.name} (Cópia)`,
          description: flow.description,
          triggers: flow.triggers,
          trigger_keywords: flow.trigger_keywords,
          department_id: flow.department_id,
          support_channel_id: flow.support_channel_id,
          flow_definition: flow.flow_definition,
          is_active: false, // Sempre inativo ao duplicar
          priority: flow.priority,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-flows"] });
      toast({
        title: "Fluxo duplicado",
        description: "O fluxo foi duplicado com sucesso. Ele foi criado como inativo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao duplicar fluxo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
