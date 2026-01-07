import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ScoreRoutingRule {
  classification: string;
  min_score: number;
  max_score: number | null;
  pipeline_id: string | null;
  playbook_id: string | null;
  playbook_start_node_id: string | null;
}

export interface ScoreRoutingConfig {
  enabled: boolean;
  rules: ScoreRoutingRule[];
}

interface Pipeline {
  id: string;
  name: string;
}

interface Playbook {
  id: string;
  name: string;
  flow_definition: unknown;
}

export function useFormScoreRouting(formId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current routing config for a form
  const routingConfigQuery = useQuery({
    queryKey: ["form-score-routing", formId],
    queryFn: async (): Promise<ScoreRoutingConfig | null> => {
      if (!formId) return null;
      const { data, error } = await supabase
        .from("forms")
        .select("score_routing_rules")
        .eq("id", formId)
        .single();

      if (error) throw error;
      const rawConfig = data?.score_routing_rules;
      if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return null;
      
      const config = rawConfig as Record<string, unknown>;
      if (typeof config.enabled !== 'boolean' || !Array.isArray(config.rules)) return null;
      
      return {
        enabled: config.enabled,
        rules: config.rules as ScoreRoutingRule[],
      };
    },
    enabled: !!formId,
  });

  // Fetch available pipelines
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines-for-routing"],
    queryFn: async (): Promise<Pipeline[]> => {
      // Using type assertion to avoid TS2589
      const client = supabase as any;
      const result = await client
        .from("pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (result.error) throw result.error;
      return (result.data || []) as Pipeline[];
    },
  });

  // Fetch available playbooks
  const playbooksQuery = useQuery({
    queryKey: ["playbooks-for-routing"],
    queryFn: async (): Promise<Playbook[]> => {
      // Using type assertion to avoid TS2589
      const client = supabase as any;
      const result = await client
        .from("onboarding_playbooks")
        .select("id, name, flow_definition")
        .eq("is_active", true)
        .order("name");

      if (result.error) throw result.error;
      return (result.data || []) as Playbook[];
    },
  });

  const playbooks = playbooksQuery.data || [];

  // Get nodes from a specific playbook
  const getPlaybookNodes = (playbookId: string) => {
    const playbook = playbooks.find((p) => p.id === playbookId);
    if (!playbook?.flow_definition) return [];

    const flow = playbook.flow_definition as { nodes?: Array<{ id: string; data?: { label?: string; type?: string } }> };
    return (flow.nodes || []).map((node) => ({
      id: node.id,
      label: node.data?.label || `Nó ${node.id}`,
      type: node.data?.type || "unknown",
    }));
  };

  // Update routing config
  const updateRoutingConfig = useMutation({
    mutationFn: async (config: ScoreRoutingConfig | null) => {
      if (!formId) throw new Error("Form ID is required");

      const client = supabase as any;
      const result = await client
        .from("forms")
        .update({ score_routing_rules: config })
        .eq("id", formId);

      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-score-routing", formId] });
      toast({
        title: "Configuração salva",
        description: "Regras de roteamento por score atualizadas.",
      });
    },
    onError: (error) => {
      console.error("Error updating routing config:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar as regras de roteamento.",
        variant: "destructive",
      });
    },
  });

  return {
    routingConfig: routingConfigQuery.data,
    isLoadingConfig: routingConfigQuery.isLoading,
    pipelines: pipelinesQuery.data || [],
    isLoadingPipelines: pipelinesQuery.isLoading,
    playbooks,
    isLoadingPlaybooks: playbooksQuery.isLoading,
    getPlaybookNodes,
    updateRoutingConfig,
  };
}
