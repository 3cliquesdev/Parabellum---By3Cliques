import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, 
  Database, 
  BookOpen, 
  ShoppingCart, 
  Package, 
  GraduationCap,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings2,
  Bot
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAIGlobalConfig } from "@/hooks/useAIGlobalConfig";
import { useStrictRAGMode } from "@/hooks/useStrictRAGMode";

interface RAGStats {
  kbArticles: number;
  kbWithEmbeddings: number;
  kiwifyContacts: number;
  sandboxRules: number;
}

interface AIPersona {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

export function RAGOrchestratorWidget() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAIEnabled, isLoading: loadingAI } = useAIGlobalConfig();
  const { isStrictMode, isLoading: loadingStrict } = useStrictRAGMode();

  // Buscar personas disponíveis
  const { data: personas, isLoading: loadingPersonas } = useQuery<AIPersona[]>({
    queryKey: ['ai-personas-for-rag'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_personas')
        .select('id, name, role, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Buscar persona global configurada
  const { data: globalPersonaId, isLoading: loadingGlobalPersona } = useQuery({
    queryKey: ['ai-global-persona'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_default_persona_id')
        .maybeSingle();
      return data?.value || null;
    },
    staleTime: 30000,
  });

  // Mutation para atualizar persona global
  const updateGlobalPersona = useMutation({
    mutationFn: async (personaId: string | null) => {
      // Verificar se já existe a configuração
      const { data: existing } = await supabase
        .from('system_configurations')
        .select('id')
        .eq('key', 'ai_default_persona_id')
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('system_configurations')
          .update({ value: personaId || '' })
          .eq('key', 'ai_default_persona_id');
        if (error) throw error;
      } else {
        // Insert new - use correct object format
        const { error } = await supabase
          .from('system_configurations')
          .insert({ 
            key: 'ai_default_persona_id', 
            value: personaId || '',
            category: 'ai'
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-global-persona'] });
      toast({ title: 'Persona global atualizada', description: 'A persona padrão do Autopilot foi salva.' });
    },
    onError: (error) => {
      console.error('Erro ao atualizar persona global:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar a persona global.', variant: 'destructive' });
    },
  });

  // Buscar estatísticas das fontes de dados
  const { data: stats, isLoading: loadingStats, refetch } = useQuery<RAGStats>({
    queryKey: ['rag-orchestrator-stats'],
    queryFn: async () => {
      // Buscar artigos da KB
      const { count: kbTotal } = await supabase
        .from('knowledge_articles')
        .select('id', { count: 'exact', head: true });

      // Buscar artigos com embeddings
      const { count: kbWithEmbed } = await supabase
        .from('knowledge_articles')
        .select('id', { count: 'exact', head: true })
        .not('embedding', 'is', null);

      // Buscar contatos com dados Kiwify
      const { count: kiwifyCount } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('kiwify_validated', true);

      // Buscar regras de sandbox/training
      const { count: sandboxCount } = await supabase
        .from('ai_training_examples')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      return {
        kbArticles: kbTotal || 0,
        kbWithEmbeddings: kbWithEmbed || 0,
        kiwifyContacts: kiwifyCount || 0,
        sandboxRules: sandboxCount || 0,
      };
    },
    staleTime: 60000, // 1 minuto
  });

  // Buscar modelo configurado
  const { data: configuredModel } = useQuery({
    queryKey: ['ai-default-model'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_default_model')
        .maybeSingle();
      return data?.value || 'gpt-4o-mini';
    },
    staleTime: 30000,
  });

  const isLoading = loadingAI || loadingStrict || loadingStats;
  const selectedPersona = personas?.find(p => p.id === globalPersonaId);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Orquestrador RAG</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={loadingStats}
          >
            <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Sistema de Recuperação e Geração Aumentada que alimenta o Autopilot
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Principal */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Status</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <Badge variant={isAIEnabled ? "success" : "destructive"} className="gap-1">
              {isAIEnabled ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Ativo
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  Desligado
                </>
              )}
            </Badge>
          )}
        </div>

        {/* Modelo em uso */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">Modelo</span>
          <span className="text-sm font-mono font-medium">
            {configuredModel?.replace('openai/', '').replace('google/', '') || 'GPT-5-mini'}
          </span>
        </div>

        {/* Modo Estrito */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">Modo Estrito (Anti-Alucinação)</span>
          {loadingStrict ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <Badge variant={isStrictMode ? "warning" : "outline"}>
              {isStrictMode ? '85%+ confiança' : 'Desativado'}
            </Badge>
          )}
        </div>

        {/* Persona Global */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Persona Global</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Persona padrão do Autopilot quando nenhum fluxo específico define
          </p>
          {loadingPersonas || loadingGlobalPersona ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select 
              value={globalPersonaId || ''} 
              onValueChange={(value) => updateGlobalPersona.mutate(value || null)}
              disabled={updateGlobalPersona.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a persona padrão..." />
              </SelectTrigger>
              <SelectContent>
                {personas?.map((persona) => (
                  <SelectItem key={persona.id} value={persona.id}>
                    {persona.name} ({persona.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedPersona && (
            <Badge variant="secondary" className="text-xs">
              {selectedPersona.name}
            </Badge>
          )}
        </div>

        {/* Fontes Conectadas */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Fontes Conectadas
          </p>

          <div className="grid gap-2">
            {/* KB */}
            <div className="flex items-center justify-between p-2 rounded border bg-card">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Base de Conhecimento</span>
              </div>
              {loadingStats ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {stats?.kbArticles || 0} artigos ({stats?.kbWithEmbeddings || 0} com embedding)
                </span>
              )}
            </div>

            {/* Kiwify/CRM */}
            <div className="flex items-center justify-between p-2 rounded border bg-card">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-green-500" />
                <span className="text-sm">Dados Kiwify (CRM)</span>
              </div>
              {loadingStats ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {stats?.kiwifyContacts || 0} clientes validados
                </span>
              )}
            </div>

            {/* Tracking */}
            <div className="flex items-center justify-between p-2 rounded border bg-card">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Rastreio Logístico</span>
              </div>
              <span className="text-xs text-muted-foreground">
                MySQL externo
              </span>
            </div>

            {/* Sandbox */}
            <div className="flex items-center justify-between p-2 rounded border bg-card">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Sandbox Training</span>
              </div>
              {loadingStats ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {stats?.sandboxRules || 0} regras ativas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate('/settings/ai')}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Configurar IA
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate('/settings/ai-trainer')}
          >
            <GraduationCap className="h-4 w-4 mr-1" />
            Treinar IA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
