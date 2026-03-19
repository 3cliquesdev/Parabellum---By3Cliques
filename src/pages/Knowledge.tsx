import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, Plus, Edit, Trash2, BookOpen, Eye, EyeOff, Upload, Sparkles, AlertTriangle, GraduationCap, FileText, SearchCheck, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useKnowledgeArticles } from "@/hooks/useKnowledgeArticles";
import { useDeleteKnowledgeArticle } from "@/hooks/useDeleteKnowledgeArticle";
import { useGenerateBatchEmbeddings } from "@/hooks/useGenerateBatchEmbeddings";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useKnowledgeStats } from "@/hooks/useKnowledgeStats";
import { useKnowledgeCandidateStats } from "@/hooks/useKnowledgeCandidates";
import { KnowledgeBrainStatus } from "@/components/KnowledgeBrainStatus";
import { KnowledgeAuditTab } from "@/components/KnowledgeAuditTab";
import KnowledgeArticleDialog from "@/components/KnowledgeArticleDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Knowledge() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("artigos");
  const [productTagManagerOpen, setProductTagManagerOpen] = useState(false);
  
  const [showDraftsOnly] = useState(filterParam === 'draft');

  const { data: articles = [], isLoading } = useKnowledgeArticles({ searchQuery, category });
  const deleteArticle = useDeleteKnowledgeArticle();
  const generateEmbeddings = useGenerateBatchEmbeddings();
  const { hasPermission } = useRolePermissions();
  const { data: stats } = useKnowledgeStats();
  const { data: candidateStats } = useKnowledgeCandidateStats();

  const canManageArticles = hasPermission('knowledge.manage_articles');

  const categories = ["all", ...Array.from(new Set(articles.map(a => a.category).filter(Boolean)))];
  
  const filteredArticles = showDraftsOnly 
    ? articles.filter(a => !a.is_published) 
    : articles;

  const handleCreateNew = () => {
    setSelectedArticle(null);
    setDialogOpen(true);
  };

  const handleEdit = (article: any) => {
    setSelectedArticle(article);
    setDialogOpen(true);
  };

  const handleDeleteClick = (articleId: string) => {
    setArticleToDelete(articleId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (articleToDelete) {
      await deleteArticle.mutateAsync(articleToDelete);
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Base de Conhecimento
          </h1>
          <p className="text-muted-foreground mt-2">
            Repositório de soluções e guias para consulta rápida
          </p>
        </div>
        {canManageArticles && (
          <div className="flex gap-2">
            {candidateStats && candidateStats.pending > 0 && (
              <Button 
                variant="outline" 
                onClick={() => navigate('/knowledge/curation')}
                className="gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                Curadoria
                <Badge variant="secondary" className="ml-1">
                  {candidateStats.pending}
                </Badge>
              </Button>
            )}
            {!candidateStats?.pending && canManageArticles && (
              <Button 
                variant="ghost" 
                onClick={() => navigate('/knowledge/curation')}
                className="gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                Curadoria
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => generateEmbeddings.mutate()}
              disabled={generateEmbeddings.isPending}
              className="gap-2"
              data-tour="knowledge-generate-embeddings"
            >
              <Sparkles className="h-4 w-4" />
              {generateEmbeddings.isPending ? 'Gerando...' : 'Gerar Embeddings'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/settings/knowledge-import')} 
              className="gap-2"
              data-tour="knowledge-import-button"
            >
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button 
              onClick={handleCreateNew} 
              className="gap-2"
              data-tour="knowledge-create-button"
            >
              <Plus className="h-4 w-4" />
              Novo Artigo
            </Button>
          </div>
        )}
      </div>

      {/* Brain Status Widget */}
      <div data-tour="knowledge-brain-status">
        <KnowledgeBrainStatus />
      </div>

      {/* Alert for missing embeddings */}
      {stats && stats.articlesWithEmbedding === 0 && stats.totalArticles > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>🔴 Busca Semântica Desabilitada</AlertTitle>
          <AlertDescription>
            Nenhum artigo possui embedding. A IA está usando busca por palavras-chave (menos precisa).
            <Button
              onClick={() => generateEmbeddings.mutate()}
              disabled={generateEmbeddings.isPending}
              className="mt-2"
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateEmbeddings.isPending ? "Gerando..." : "Gerar Embeddings Agora"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs: Artigos | Auditoria */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="artigos" className="gap-2">
            <FileText className="h-4 w-4" />
            Artigos
          </TabsTrigger>
          {canManageArticles && (
            <TabsTrigger value="auditoria" className="gap-2">
              <SearchCheck className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
          )}
        </TabsList>
        {canManageArticles && (
          <Button variant="outline" size="sm" onClick={() => setProductTagManagerOpen(true)} className="gap-2">
            <Tag className="h-4 w-4" />
            Product Tags
          </Button>
        )}

        <TabsContent value="artigos" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1" data-tour="knowledge-search">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por título ou conteúdo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.filter(c => c !== "all").map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Articles List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando artigos...
            </div>
          ) : filteredArticles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || category !== "all" 
                    ? "Nenhum artigo encontrado com os filtros aplicados"
                    : showDraftsOnly
                    ? "Nenhum rascunho disponível"
                    : "Nenhum artigo disponível ainda"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredArticles.map((article) => (
                <Card key={article.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-xl">{article.title}</CardTitle>
                          {!article.is_published && (
                            <Badge variant="secondary" className="gap-1">
                              <EyeOff className="h-3 w-3" />
                              Rascunho
                            </Badge>
                          )}
                          {article.is_published && (
                            <Badge variant="default" className="gap-1">
                              <Eye className="h-3 w-3" />
                              Publicado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {article.category && (
                            <Badge variant="outline">{article.category}</Badge>
                          )}
                          {article.tags?.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {canManageArticles && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(article)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(article.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-3 whitespace-pre-wrap">
                      {article.content}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {canManageArticles && (
          <TabsContent value="auditoria">
            <KnowledgeAuditTab />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <KnowledgeArticleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        article={selectedArticle}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este artigo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
