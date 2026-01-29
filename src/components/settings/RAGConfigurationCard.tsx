import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, Cpu, Database, BookOpen, Users, Truck, Sparkles, Shield, Loader2 } from "lucide-react";
import { useRAGConfig, RAG_MODELS } from "@/hooks/useRAGConfig";

export function RAGConfigurationCard() {
  const {
    config,
    isLoading,
    isSaving,
    updateModel,
    updateMinThreshold,
    updateDirectThreshold,
    toggleSource,
    toggleStrictMode,
  } = useRAGConfig();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Configuração do RAG</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentModel = RAG_MODELS.find((m) => m.id === config.model);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Configuração do RAG</CardTitle>
          </div>
          {isSaving && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Salvando...
            </Badge>
          )}
        </div>
        <CardDescription>
          Controle total do Retrieval-Augmented Generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selector */}
        <div className="space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            Modelo da IA
          </label>
          <Select value={config.model} onValueChange={updateModel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              <div className="py-1 px-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                OpenAI (Recomendado)
              </div>
              {RAG_MODELS.filter((m) => m.provider === "OpenAI").map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {model.badge && (
                      <Badge variant={model.badge === "Recomendado" ? "default" : "outline"} className="text-xs py-0">
                        {model.badge}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
              <div className="py-1 px-2 text-xs font-semibold text-muted-foreground bg-muted/50 mt-1">
                Google Gemini
              </div>
              {RAG_MODELS.filter((m) => m.provider === "Google").map((model) => (
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
          {currentModel && (
            <p className="text-xs text-muted-foreground">
              {currentModel.description}
            </p>
          )}
        </div>

        <Separator />

        {/* Confidence Thresholds */}
        <div className="space-y-4">
          <label className="text-sm font-medium">Thresholds de Confiança</label>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mínimo (handoff se abaixo)</span>
                <span className="text-sm font-medium">{Math.round(config.minThreshold * 100)}%</span>
              </div>
              <Slider
                value={[config.minThreshold * 100]}
                min={5}
                max={50}
                step={5}
                onValueCommit={(value) => updateMinThreshold(value[0] / 100)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Direto (sem cautela)</span>
                <span className="text-sm font-medium">{Math.round(config.directThreshold * 100)}%</span>
              </div>
              <Slider
                value={[config.directThreshold * 100]}
                min={50}
                max={95}
                step={5}
                onValueCommit={(value) => updateDirectThreshold(value[0] / 100)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Data Sources */}
        <div className="space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Fontes de Dados
          </label>
          
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => toggleSource("kb")}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                config.sources.kb ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox checked={config.sources.kb} />
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Base de Conhecimento</span>
              </div>
            </div>

            <div
              onClick={() => toggleSource("crm")}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                config.sources.crm ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox checked={config.sources.crm} />
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                <span className="text-sm">Dados CRM (Kiwify)</span>
              </div>
            </div>

            <div
              onClick={() => toggleSource("tracking")}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                config.sources.tracking ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox checked={config.sources.tracking} />
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Rastreio Logístico</span>
              </div>
            </div>

            <div
              onClick={() => toggleSource("sandbox")}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                config.sources.sandbox ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox checked={config.sources.sandbox} />
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Sandbox Training</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Strict Mode Toggle */}
        <div
          onClick={() => toggleStrictMode(!config.strictMode)}
          className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
            config.strictMode ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700" : "hover:bg-muted/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <Shield className={`h-5 w-5 ${config.strictMode ? "text-amber-600" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-medium">Modo Estrito Anti-Alucinação</p>
              <p className="text-xs text-muted-foreground">
                85%+ confiança, citação obrigatória
              </p>
            </div>
          </div>
          <Switch checked={config.strictMode} />
        </div>
      </CardContent>
    </Card>
  );
}
