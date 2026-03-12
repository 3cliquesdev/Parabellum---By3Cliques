import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Zap, Crown, Target, Rocket, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIModel {
  id: string;
  name: string;
  provider: "google" | "openai";
  description: string;
  icon: typeof Brain;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline";
}

const AI_MODELS: AIModel[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "🎯 Balanceado - Boa performance com custo menor",
    icon: Target,
    badge: "Recomendado",
    badgeVariant: "default",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "💎 Máxima precisão - Melhor raciocínio e nuance",
    icon: Crown,
    badge: "Premium",
    badgeVariant: "secondary",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "⚡ Ultra-rápido - Ideal para tarefas simples",
    icon: Zap,
    badge: "Econômico",
    badgeVariant: "outline",
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "🆕 Última geração - Raciocínio avançado",
    icon: Rocket,
    badge: "Novo",
    badgeVariant: "outline",
  },
];

export default function AIModelConfigCard() {
  const [currentModel, setCurrentModel] = useState<string>("gpt-4o-mini");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentModel();
  }, []);

  const loadCurrentModel = async () => {
    try {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("value")
        .eq("key", "ai_default_model")
        .maybeSingle();

      if (!error && data?.value) {
        setCurrentModel(data.value);
      }
    } catch (error) {
      console.error("Error loading AI model config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("system_configurations")
        .upsert({
          key: "ai_default_model",
          value: modelId,
          description: "Modelo AI padrão para todas as funções",
          category: "ai",
        }, { onConflict: "key" });

      if (error) throw error;

      setCurrentModel(modelId);
      
      const model = AI_MODELS.find(m => m.id === modelId);
      toast({
        title: "Modelo AI atualizado",
        description: `Agora usando ${model?.name || modelId} em todas as funções.`,
      });
    } catch (error) {
      console.error("Error saving AI model:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o modelo AI.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedModel = AI_MODELS.find(m => m.id === currentModel);
  const SelectedIcon = selectedModel?.icon || Brain;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Modelo AI</CardTitle>
          </div>
          {selectedModel && (
            <Badge variant={selectedModel.badgeVariant}>
              {selectedModel.badge}
            </Badge>
          )}
        </div>
        <CardDescription>
          Selecione o modelo de IA usado em todas as funções (Autopilot, Copilot, Análises)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Current Model Display */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <SelectedIcon className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-foreground">{selectedModel?.name}</div>
                <div className="text-sm text-muted-foreground">{selectedModel?.description}</div>
              </div>
              <Badge variant="outline" className="text-xs">
                {selectedModel?.provider === "google" ? "Google" : "OpenAI"}
              </Badge>
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Trocar modelo</label>
              <Select value={currentModel} onValueChange={handleModelChange} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Google Gemini
                  </div>
                  {AI_MODELS.filter(m => m.provider === "google").map((model) => {
                    const Icon = model.icon;
                    return (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{model.name}</span>
                          {model.id === currentModel && (
                            <Check className="h-3 w-3 text-primary ml-auto" />
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                  
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                    OpenAI
                  </div>
                  {AI_MODELS.filter(m => m.provider === "openai").map((model) => {
                    const Icon = model.icon;
                    return (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{model.name}</span>
                          {model.id === currentModel && (
                            <Check className="h-3 w-3 text-primary ml-auto" />
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {isSaving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando configuração...
              </div>
            )}

            {/* Info */}
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
              💡 <strong>Dica:</strong> Use Gemini Flash para economia ou GPT-5 quando precisar de máxima precisão.
              A mudança é aplicada imediatamente em todas as Edge Functions.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
