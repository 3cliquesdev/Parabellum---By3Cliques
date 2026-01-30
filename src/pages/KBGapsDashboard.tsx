import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Loader2
} from "lucide-react";
import { useKBGapsDashboard, useMarkSuggestionAsUsed } from "@/hooks/useCopilotSuggestions";
import { useGenerateKBDraft } from "@/hooks/useGenerateKBDraft";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function KBGapsDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingGapId, setGeneratingGapId] = useState<string | null>(null);
  const { data: gaps, isLoading, refetch } = useKBGapsDashboard(100);
  const markAsUsed = useMarkSuggestionAsUsed();
  const generateDraft = useGenerateKBDraft();

  const filteredGaps = gaps?.filter(gap => 
    gap.kb_gap_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (gap.conversations as any)?.contact?.first_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleDismiss = async (gapId: string) => {
    markAsUsed.mutate(gapId);
    toast.success("Lacuna marcada como resolvida");
  };

  const handleCreateArticle = (gap: any) => {
    // Navigate to knowledge creation with pre-filled data
    const params = new URLSearchParams({
      from_gap: gap.id,
      problem: gap.kb_gap_description || '',
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

  return (
    <Layout>
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
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                Lacunas de Conhecimento
              </h1>
              <p className="text-muted-foreground text-sm">
                Problemas detectados pela IA que não possuem artigos na base de conhecimento
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Lacunas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {gaps?.length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimas 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {gaps?.filter(g => {
                  const created = new Date(g.created_at);
                  const now = new Date();
                  return (now.getTime() - created.getTime()) < 24 * 60 * 60 * 1000;
                }).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ação Recomendada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium text-amber-700">
                Criar artigos para as lacunas mais frequentes
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar lacunas por descrição ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lacunas Detectadas</CardTitle>
            <CardDescription>
              Clique em "Criar Artigo" para transformar a lacuna em conhecimento útil
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredGaps.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma lacuna detectada!</h3>
                <p className="text-muted-foreground">
                  A IA não identificou problemas sem artigos na base de conhecimento.
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
                  {filteredGaps.map((gap) => {
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
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
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
      </div>
    </Layout>
  );
}
