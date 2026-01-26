import { ArrowLeft, Brain, Sparkles, BookOpen, Power, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import AIModelConfigCard from "@/components/settings/AIModelConfigCard";
import { AITrainerStatsWidget } from "@/components/settings/AITrainerStatsWidget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAIGlobalConfig } from "@/hooks/useAIGlobalConfig";
import { useStrictRAGMode } from "@/hooks/useStrictRAGMode";

export default function AISettingsPage() {
  const navigate = useNavigate();
  const { isAIEnabled, isLoading, toggleAI, isToggling } = useAIGlobalConfig();
  const { isStrictMode, isLoading: isLoadingStrict, toggleStrictMode, isToggling: isTogglingStrict } = useStrictRAGMode();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Inteligência Artificial
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure o modelo, treinamento e base de conhecimento da IA
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* AI Global Toggle - NEW */}
        <Card className={isAIEnabled ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className={`h-5 w-5 ${isAIEnabled ? 'text-green-500' : 'text-destructive'}`} />
              Status Global da IA
            </CardTitle>
            <CardDescription>
              Controle mestre para ativar ou desativar a IA em todo o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  IA {isAIEnabled ? 'Ativada' : 'Desativada'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isAIEnabled 
                    ? 'A IA está respondendo conversas conforme configuração de cada instância' 
                    : 'Nenhuma conversa será atendida pela IA enquanto estiver desligada'}
                </p>
              </div>
              <Switch 
                checked={isAIEnabled} 
                onCheckedChange={toggleAI}
                disabled={isLoading || isToggling}
              />
            </div>
          </CardContent>
        </Card>

        {/* Strict RAG Mode - NEW */}
        <Card className={isStrictMode ? "border-orange-500/30 bg-orange-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className={`h-5 w-5 ${isStrictMode ? 'text-orange-500' : 'text-muted-foreground'}`} />
              Modo RAG Estrito (Anti-Alucinação)
            </CardTitle>
            <CardDescription>
              Usa exclusivamente OpenAI GPT-4o com thresholds rígidos de confiança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {isStrictMode ? 'Ativado' : 'Desativado'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isStrictMode 
                    ? 'IA só responde com 85%+ de confiança na KB, cita fontes, nunca alucina' 
                    : 'Modo padrão - usa modelo configurado com fallback para Lovable AI'}
                </p>
              </div>
              <Switch 
                checked={isStrictMode} 
                onCheckedChange={toggleStrictMode}
                disabled={isLoadingStrict || isTogglingStrict || !isAIEnabled}
              />
            </div>
            
            {isStrictMode && (
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-600">Comportamento quando ativo:</p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      <li>• <strong>Modelo:</strong> OpenAI GPT-4o exclusivo (sem fallback)</li>
                      <li>• <strong>Threshold:</strong> 85% mínimo de confiança para responder</li>
                      <li>• <strong>Temperatura:</strong> 0.3 (baixa criatividade = alta fidelidade)</li>
                      <li>• <strong>Citação:</strong> Sempre cita a fonte da KB na resposta</li>
                      <li>• <strong>Handoff:</strong> Automático se não encontrar artigo relevante</li>
                      <li>• <strong>Validação:</strong> Detecta incerteza e força handoff</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Model Selection */}
        <AIModelConfigCard />

        {/* AI Trainer Stats */}
        <AITrainerStatsWidget />

        {/* Knowledge Base Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-400" />
              Base de Conhecimento
            </CardTitle>
            <CardDescription>
              Importe dados de CSV/Excel para alimentar a IA com informações específicas do seu negócio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/settings/knowledge-import')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Importar Conhecimento
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
