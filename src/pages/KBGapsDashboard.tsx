import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  Check,
  X,
  Loader2,
  Radar,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useKBGapsDashboard, useMarkSuggestionAsUsed } from "@/hooks/useCopilotSuggestions";
import { useAutoDetectedGaps, useDismissAutoGap, useApproveAutoGap, useTriggerGapDetection } from "@/hooks/useAutoDetectedGaps";
import { useGenerateKBDraft } from "@/hooks/useGenerateKBDraft";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function KBGapsDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("auto");
  const [generatingGapId, setGeneratingGapId] = useState<string | null>(null);

  // Copilot suggestions (fonte antiga)
  const { data: copilotGaps, isLoading: copilotLoading, refetch: refetchCopilot } = useKBGapsDashboard(100);
  const markAsUsed = useMarkSuggestionAsUsed();
  const generateDraft = useGenerateKBDraft();

  // Auto-detected gaps (nova fonte: knowledge_candidates)
  const { data: autoGaps, isLoading: autoLoading, refetch: refetchAuto } = useAutoDetectedGaps(100);
  const dismissGap = useDismissAutoGap();
  const approveGap = useApproveAutoGap();
  const triggerDetection = useTriggerGapDetection();

  // Filtered data
  const filteredCopilotGaps = copilotGaps?.filter(gap =>
    gap.kb_gap_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (gap.conversations as any)?.contact?.first_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredAutoGaps = autoGaps?.filter(gap =>
    gap.problem?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gap.solution?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gap.department?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const pendingAutoGaps = autoGaps?.filter(g => g.status === 'pending') || [];
  const highSeverityGaps = autoGaps?.filter(g => g.tags?.includes('severity_high')) || [];

  const handleRefresh = () => {
    refetchCopilot();
    refetchAuto();
  };

  const handleDismiss = async (gapId: string) => {
    markAsUsed.mutate(gapId);
    toast.success("Lacuna marcada como resolvida");
  };

  const handleCreateArticle = (gap: any) => {
    const params = new URLSearchParams({
      from_gap: gap.id,
      problem: gap.kb_gap_description || gap.problem || '',
    });
    window.location.href = `/knowledge?action=create&${params.toString()}`;
  };

  const handleGenerateDraft = async (gap: any) => {
    setGeneratingGapId(gap.id);
    try {
      await generateDraft.mutateAsync(gap.id);
    } finally {
      setGeneratingGapId(null);
    }
  };

  const getSeverityBadge = (tags: string[]) => {
    if (tags?.includes('severity_high')) return <Badge variant="destructive" className="text-xs">Alta</Badge>;
    if (tags?.includes('severity_medium')) return <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-300">Média</Badge>;
    return <Badge variant="outline" className="text-xs">Baixa</Badge>;
  };

  const getSourceBadges = (tags: string[]) => {
    const sources: string[] = [];
    if (tags?.includes('ai_handoff_exit')) sources.push('Handoff');
    if (tags?.includes('low_confidence')) sources.push('Baixa Confiança');
    if (tags?.includes('low_conf_handoff')) sources.push('Baixa Conf. + Handoff');
    if (tags?.includes('copilot_kb_gap')) sources.push('Copilot');
    if (tags?.includes('contract_violation_blocked')) sources.push('Violação');
    if (tags?.includes('kb_no_match')) sources.push('Sem Match KB');
    if (tags?.includes('flow_exit_clean')) sources.push('Saída Fluxo');
    return sources;
  };

  return (
    <div className="container py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/knowledge">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radar className="h-6 w-6 text-amber-500" />
              Lacunas de Conhecimento
            </h1>
            <p className="text-muted-foreground text-sm">
              Gaps detectados automaticamente pela IA — crie artigos para cobrir esses temas
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => triggerDetection.mutate()}
            disabled={triggerDetection.isPending}
          >
            {triggerDetection.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Detectar Agora
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={copilotLoading || autoLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(copilotLoading || autoLoading) ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gaps Auto-Detectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {pendingAutoGaps.length}
            </div>
            <p className="text-xs text-muted-foreground">pendentes de revisão</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alta Severidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {highSeverityGaps.length}
            </div>
            <p className="text-xs text-muted-foreground">requerem ação urgente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Copilot KB Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {copilotGaps?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">sugestões ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(autoGaps?.length || 0) + (copilotGaps?.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">todos os sinais</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lacunas por descrição, departamento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="auto" className="gap-2">
            <Radar className="h-4 w-4" />
            Auto-Detectados
            {pendingAutoGaps.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                {pendingAutoGaps.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="copilot" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Copilot Sugestões
            {(copilotGaps?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {copilotGaps?.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Auto-detected gaps tab */}
        <TabsContent value="auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Gaps Auto-Detectados
              </CardTitle>
              <CardDescription>
                Temas recorrentes onde a IA não conseguiu responder — baseado em handoffs, baixa confiança e saídas de fluxo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {autoLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredAutoGaps.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma lacuna auto-detectada!</h3>
                  <p className="text-muted-foreground mb-4">
                    A IA não identificou gaps recorrentes. Clique em "Detectar Agora" para forçar uma análise.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">Tema / Problema</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Fontes</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAutoGaps.map((gap) => {
                      const sources = getSourceBadges(gap.tags);
                      return (
                        <TableRow key={gap.id}>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-sm font-medium">
                                  {gap.problem?.replace('[GAP DETECTADO] ', '').substring(0, 100)}
                                </span>
                                {gap.when_to_use && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {gap.when_to_use}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getSeverityBadge(gap.tags)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {sources.slice(0, 2).map((src, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {src}
                                </Badge>
                              ))}
                              {sources.length > 2 && (
                                <Badge variant="outline" className="text-xs">+{sources.length - 2}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {gap.department ? (
                              <Badge variant="outline" className="text-xs">
                                {gap.department.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(gap.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={gap.status === 'pending' ? 'secondary' : gap.status === 'approved' ? 'default' : 'outline'} className="text-xs">
                              {gap.status === 'pending' ? 'Pendente' : gap.status === 'approved' ? 'Aprovado' : 'Resolvido'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateArticle(gap)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Criar Artigo
                              </Button>
                              {gap.status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => approveGap.mutate(gap.id)}
                                    disabled={approveGap.isPending}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Aprovar gap"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => dismissGap.mutate(gap.id)}
                                    disabled={dismissGap.isPending}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Descartar gap"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Copilot suggestions tab */}
        <TabsContent value="copilot">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Sugestões do Copilot
              </CardTitle>
              <CardDescription>
                Lacunas identificadas pelo Copilot durante atendimentos individuais
              </CardDescription>
            </CardHeader>
            <CardContent>
              {copilotLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredCopilotGaps.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma sugestão do Copilot!</h3>
                  <p className="text-muted-foreground">
                    O Copilot não identificou lacunas recentes.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Descrição da Lacuna</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCopilotGaps.map((gap) => {
                      const conversation = gap.conversations as any;
                      const contact = conversation?.contact;

                      return (
                        <TableRow key={gap.id}>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{gap.kb_gap_description}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {contact ? (
                              <span className="text-sm">
                                {contact.first_name} {contact.last_name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {conversation?.department ? (
                              <Badge variant="outline" className="text-xs">
                                {conversation.department}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(gap.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {conversation?.id && (
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/inbox?conversation=${conversation.id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                              )}
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleGenerateDraft(gap)}
                                disabled={generatingGapId === gap.id}
                                className="bg-primary hover:bg-primary/90"
                              >
                                {generatingGapId === gap.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Sparkles className="h-4 w-4 mr-1" />
                                )}
                                Gerar com IA
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateArticle(gap)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Manual
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDismiss(gap.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="mt-6 border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Como funciona a Detecção de Gaps
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Auto-Detecção (diária às 8h):</strong> Analisa handoffs, respostas de baixa confiança, 
            saídas de fluxo e violações das últimas 24h. Agrupa por similaridade e cria candidatos para revisão.
          </p>
          <p>
            <strong>Copilot Sugestões:</strong> Identificadas em tempo real durante atendimentos quando o Copilot 
            detecta que não há artigo adequado na base de conhecimento.
          </p>
          <p>
            <strong>Ações:</strong> "Criar Artigo" abre o editor com dados pré-preenchidos. "Gerar com IA" cria 
            automaticamente um rascunho baseado no contexto do gap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
