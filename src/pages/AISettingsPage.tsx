import { ArrowLeft, Brain, Sparkles, BookOpen, Power, Shield, AlertTriangle, Eye, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import AIModelConfigCard from "@/components/settings/AIModelConfigCard";
import { AITrainerStatsWidget } from "@/components/settings/AITrainerStatsWidget";
import { RAGOrchestratorWidget } from "@/components/settings/RAGOrchestratorWidget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAIGlobalConfig } from "@/hooks/useAIGlobalConfig";
import { useStrictRAGMode } from "@/hooks/useStrictRAGMode";
import { useShadowMode } from "@/hooks/useShadowMode";
import { useAILearningTimeline } from "@/hooks/useAILearningTimeline";

export default function AISettingsPage() {
  const navigate = useNavigate();
  const { isAIEnabled, isLoading, toggleAI, isToggling } = useAIGlobalConfig();
  const { isStrictMode, isLoading: isLoadingStrict, toggleStrictMode, isToggling: isTogglingStrict } = useStrictRAGMode();
  const { isShadowMode, isLoading: isLoadingShadow, toggleShadowMode, isToggling: isTogglingShadow } = useShadowMode();
  const { stats: auditStats } = useAILearningTimeline({ status: 'pending' });

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
              <Brain className="h-5 w-5 text-primary" />
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
        {/* Layout em 2 colunas para telas maiores */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna Principal (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Global Toggle */}
            <Card className={isAIEnabled ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Power className={`h-5 w-5 ${isAIEnabled ? 'text-success' : 'text-destructive'}`} />
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

            {/* Shadow Mode - FASE 6 */}
            <Card className={isShadowMode ? "border-primary/30 bg-primary/5" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className={`h-5 w-5 ${isShadowMode ? 'text-primary' : 'text-muted-foreground'}`} />
                  Shadow Mode (Apenas Observa)
                </CardTitle>
                <CardDescription>
                  IA analisa e sugere, mas NUNCA aplica ações automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {isShadowMode ? 'Ativado' : 'Desativado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isShadowMode 
                        ? 'IA gera sugestões mas requer aprovação humana para aplicar' 
                        : 'IA pode executar ações automaticamente conforme regras'}
                    </p>
                  </div>
                  <Switch 
                    checked={isShadowMode} 
                    onCheckedChange={toggleShadowMode}
                    disabled={isLoadingShadow || isTogglingShadow || !isAIEnabled}
                  />
                </div>
                
                {isShadowMode && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Eye className="h-4 w-4 text-primary mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-primary">Comportamento quando ativo:</p>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          <li>• <strong>Sugestões:</strong> IA gera mas não aplica</li>
                          <li>• <strong>KB Drafts:</strong> Criados como pendentes para revisão</li>
                          <li>• <strong>Roteamento:</strong> Sugerido mas não executado</li>
                          <li>• <strong>Aprendizado:</strong> Registrado para aprovação na Auditoria</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit Link - FASE 6 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Auditoria de IA
                  {auditStats.pending > 0 && (
                    <span className="ml-2 bg-warning text-warning-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                      {auditStats.pending} pendentes
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Revise e aprove/rejeite aprendizados automáticos da IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link to="/settings/ai-audit">
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Abrir Auditoria
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Strict RAG Mode */}
            <Card className={isStrictMode ? "border-warning/30 bg-warning/5" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className={`h-5 w-5 ${isStrictMode ? 'text-warning' : 'text-muted-foreground'}`} />
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
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning">Comportamento quando ativo:</p>
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
                  <BookOpen className="h-5 w-5 text-primary" />
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
          </div>

          {/* Coluna Lateral (1/3) - RAG Orchestrator */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <RAGOrchestratorWidget />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
