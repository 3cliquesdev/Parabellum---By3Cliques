import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RAGSources {
  kb: boolean;
  crm: boolean;
  tracking: boolean;
  sandbox: boolean;
}

export interface RAGConfig {
  model: string;
  minThreshold: number;
  directThreshold: number;
  sources: RAGSources;
  strictMode: boolean;
}

const DEFAULT_CONFIG: RAGConfig = {
  model: "gpt-4o-mini",
  minThreshold: 0.10,
  directThreshold: 0.75,
  sources: {
    kb: true,
    crm: true,
    tracking: true,
    sandbox: true,
  },
  strictMode: false,
};

// Models available - OpenAI direct API
export const RAG_MODELS = [
  // Chat Models
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", category: "chat", description: "Balanceado - Custo-benefício", badge: "Recomendado" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", category: "chat", description: "Máxima precisão multimodal", badge: "Premium" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "OpenAI", category: "chat", description: "Mais barato - Tarefas simples", badge: "Econômico" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", category: "chat", description: "Ultra rápido - Alto volume", badge: "Rápido" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "OpenAI", category: "chat", description: "Última geração - Contexto longo", badge: "Novo" },
  { id: "gpt-5-nano", name: "GPT-5 Nano", provider: "OpenAI", category: "chat", description: "Velocidade + economia máxima", badge: "Econômico" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "OpenAI", category: "chat", description: "Forte performance - Custo moderado", badge: "Balanceado" },
  { id: "gpt-5", name: "GPT-5", provider: "OpenAI", category: "chat", description: "Máxima capacidade - Raciocínio + multimodal", badge: "Premium+" },
  // Reasoning Models
  { id: "o4-mini", name: "o4-mini", provider: "OpenAI", category: "reasoning", description: "Raciocínio avançado - Custo acessível", badge: "Smart" },
  { id: "o3", name: "o3", provider: "OpenAI", category: "reasoning", description: "Raciocínio máximo - Problemas complexos", badge: "Top" },
  { id: "o3-mini", name: "o3-mini", provider: "OpenAI", category: "reasoning", description: "Raciocínio econômico - Bom equilíbrio", badge: "Eficiente" },
];

export function useRAGConfig() {
  const queryClient = useQueryClient();

  // Fetch all RAG configurations
  const { data: rawConfigs, isLoading } = useQuery({
    queryKey: ["rag-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("key, value")
        .in("key", [
          "ai_default_model",
          "ai_rag_min_threshold",
          "ai_rag_direct_threshold",
          "ai_rag_sources_enabled",
          "ai_strict_rag_mode",
        ]);

      if (error) {
        console.error("[useRAGConfig] Error fetching:", error);
        throw error;
      }
      return data || [];
    },
    staleTime: 30000,
  });

  // Parse raw configs into structured format
  const config: RAGConfig = {
    model: rawConfigs?.find((c) => c.key === "ai_default_model")?.value || DEFAULT_CONFIG.model,
    minThreshold: parseFloat(rawConfigs?.find((c) => c.key === "ai_rag_min_threshold")?.value || String(DEFAULT_CONFIG.minThreshold)),
    directThreshold: parseFloat(rawConfigs?.find((c) => c.key === "ai_rag_direct_threshold")?.value || String(DEFAULT_CONFIG.directThreshold)),
    sources: (() => {
      try {
        const sourcesStr = rawConfigs?.find((c) => c.key === "ai_rag_sources_enabled")?.value;
        return sourcesStr ? JSON.parse(sourcesStr) : DEFAULT_CONFIG.sources;
      } catch {
        return DEFAULT_CONFIG.sources;
      }
    })(),
    strictMode: rawConfigs?.find((c) => c.key === "ai_strict_rag_mode")?.value === "true",
  };

  // Mutation to update a single configuration
  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      console.log("[useRAGConfig] Updating:", key, value);
      
      const { error } = await supabase
        .from("system_configurations")
        .upsert(
          {
            key,
            value,
            category: "ai",
            description: getConfigDescription(key),
          },
          { onConflict: "key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rag-config"] });
    },
    onError: (error) => {
      console.error("[useRAGConfig] Update error:", error);
      toast.error("Erro ao salvar configuração");
    },
  });

  // Helper functions for updating specific configs
  const updateModel = (model: string) => {
    updateConfigMutation.mutate({ key: "ai_default_model", value: model });
    toast.success(`Modelo alterado para ${RAG_MODELS.find(m => m.id === model)?.name || model}`);
  };

  const updateMinThreshold = (value: number) => {
    updateConfigMutation.mutate({ key: "ai_rag_min_threshold", value: String(value) });
  };

  const updateDirectThreshold = (value: number) => {
    updateConfigMutation.mutate({ key: "ai_rag_direct_threshold", value: String(value) });
  };

  const updateSources = (sources: RAGSources) => {
    updateConfigMutation.mutate({ key: "ai_rag_sources_enabled", value: JSON.stringify(sources) });
    toast.success("Fontes de dados atualizadas");
  };

  const toggleSource = (sourceKey: keyof RAGSources) => {
    const newSources = { ...config.sources, [sourceKey]: !config.sources[sourceKey] };
    updateSources(newSources);
  };

  const toggleStrictMode = (enabled: boolean) => {
    updateConfigMutation.mutate({ key: "ai_strict_rag_mode", value: enabled ? "true" : "false" });
    toast.success(enabled ? "Modo Estrito ativado" : "Modo Estrito desativado");
  };

  return {
    config,
    isLoading,
    isSaving: updateConfigMutation.isPending,
    updateModel,
    updateMinThreshold,
    updateDirectThreshold,
    updateSources,
    toggleSource,
    toggleStrictMode,
  };
}

function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    ai_default_model: "Modelo de IA padrão para o Autopilot",
    ai_rag_min_threshold: "Score mínimo de confiança (abaixo disso = handoff)",
    ai_rag_direct_threshold: "Score para resposta direta sem cautela",
    ai_rag_sources_enabled: "Fontes de dados ativas para RAG (JSON)",
    ai_strict_rag_mode: "Modo estrito anti-alucinação",
  };
  return descriptions[key] || "";
}
