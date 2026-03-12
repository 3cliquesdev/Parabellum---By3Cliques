import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Brain, ArrowLeft, Settings, Sparkles, Zap, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AITrainerStatsWidget } from "@/components/settings/AITrainerStatsWidget";
import { KnowledgeSourcesWidget } from "@/components/settings/KnowledgeSourcesWidget";
import { PersonaDataAccessWidget } from "@/components/settings/PersonaDataAccessWidget";
import { RAGConfigurationCard } from "@/components/settings/RAGConfigurationCard";
import { KnowledgeBrainStatus } from "@/components/KnowledgeBrainStatus";
import { useRolePermissions } from "@/hooks/useRolePermissions";

// Modelos disponíveis - OpenAI direta
const AVAILABLE_MODELS = [
  // Chat
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", description: "Balanceado - Rápido e preciso", badge: "Recomendado" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Máxima precisão multimodal", badge: "Premium" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "OpenAI", description: "Mais barato - Tarefas simples", badge: "Econômico" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", description: "Ultra rápido - Alto volume", badge: "Rápido" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "OpenAI", description: "Última geração - Contexto longo", badge: "Novo" },
  // Reasoning
  { id: "o4-mini", name: "o4-mini", provider: "OpenAI", description: "Raciocínio avançado - Custo acessível", badge: "Smart" },
  { id: "o3", name: "o3", provider: "OpenAI", description: "Raciocínio máximo", badge: "Top" },
  { id: "o3-mini", name: "o3-mini", provider: "OpenAI", description: "Raciocínio econômico", badge: "Eficiente" },
];

export default function AITrainer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Buscar modelo configurado
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ["ai-trainer-model-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("*")
        .eq("key", "ai_model_analysis")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Atualizar modelo
  const updateModelMutation = useMutation({
    mutationFn: async (model: string) => {
      if (currentConfig) {
        // Update existente
        const { error } = await supabase
          .from("system_configurations")
          .update({ value: model })
          .eq("key", "ai_model_analysis");
        if (error) throw error;
      } else {
        // Insert novo
        const { error } = await supabase
          .from("system_configurations")
          .insert({
            key: "ai_model_analysis",
            value: model,
            category: "ai",
            description: "Modelo de IA usado pelo Agente de Treinamento Autônomo",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Modelo atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["ai-trainer-model-config"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar modelo");
      console.error(error);
    },
  });

  // Set selected model when config loads
  const configuredModel = currentConfig?.value || "gpt-4o-mini";

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasPermission("ai.train")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Você não tem permissão para acessar o AI Trainer.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveModel = () => {
    if (selectedModel && selectedModel !== configuredModel) {
      updateModelMutation.mutate(selectedModel);
    }
  };

  const currentModelInfo = AVAILABLE_MODELS.find(m => m.id === configuredModel);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Central de Conhecimento da IA
          </h1>
          <p className="text-muted-foreground">
            Gerencie todas as fontes de dados que a IA utiliza para responder
          </p>
        </div>
      </div>

      {/* Knowledge Brain Status (Overview Stats) */}
      <KnowledgeBrainStatus />

      {/* RAG Configuration Card - NEW! */}
      <RAGConfigurationCard />

      {/* Knowledge Sources Widget */}
      <KnowledgeSourcesWidget />

      {/* Persona Data Access Widget (Editable) */}
      <PersonaDataAccessWidget />

      {/* Model Selection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Agente de Treinamento Autônomo</CardTitle>
          </div>
          <CardDescription>
            IA que aprende automaticamente com atendimentos bem-sucedidos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Model Display */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Modelo Atual</p>
                <p className="font-medium text-foreground">{currentModelInfo?.name || configuredModel}</p>
                <p className="text-xs text-muted-foreground">{currentModelInfo?.description}</p>
              </div>
              {currentModelInfo?.badge && (
                <Badge variant="secondary">{currentModelInfo.badge}</Badge>
              )}
            </div>
          </div>

          {/* Model Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Alterar Modelo</label>
            <Select
              value={selectedModel || configuredModel}
              onValueChange={setSelectedModel}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                <div className="py-1 px-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                  Google Gemini
                </div>
                {AVAILABLE_MODELS.filter(m => m.provider === "Google").map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {model.badge && (
                        <Badge variant="outline" className="text-xs py-0">
                          {model.badge}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
                <div className="py-1 px-2 text-xs font-semibold text-muted-foreground bg-muted/50 mt-1">
                  OpenAI GPT
                </div>
                {AVAILABLE_MODELS.filter(m => m.provider === "OpenAI").map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {model.badge && (
                        <Badge variant="outline" className="text-xs py-0">
                          {model.badge}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedModel && selectedModel !== configuredModel && (
              <Button 
                onClick={handleSaveModel} 
                disabled={updateModelMutation.isPending}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {updateModelMutation.isPending ? "Salvando..." : "Salvar Novo Modelo"}
              </Button>
            )}
          </div>

          {/* Model Info Cards */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t">
            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <Zap className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Flash/Nano</p>
              <p className="text-xs text-muted-foreground">Rápido & Econômico</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Brain className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Pro/GPT-5</p>
              <p className="text-xs text-muted-foreground">Alta Precisão</p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">CRON</p>
              <p className="text-xs text-muted-foreground">Executa a cada hora</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Widget */}
      <AITrainerStatsWidget />
    </div>
  );
}
