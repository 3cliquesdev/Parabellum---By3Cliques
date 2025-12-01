import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, FileText, FolderTree, Clock } from "lucide-react";
import { useKnowledgeStats } from "@/hooks/useKnowledgeStats";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function KnowledgeBrainStatus() {
  const { data: stats, isLoading } = useKnowledgeStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const isRecent = stats?.lastUpdated
    ? Date.now() - stats.lastUpdated.getTime() < 24 * 60 * 60 * 1000
    : false;

  const hasEmbeddings = (stats?.articlesWithEmbedding ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Documentos Indexados
            </h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {stats?.totalArticles ?? 0}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Com Embedding
            </h3>
          </div>
          <p
            className={`text-3xl font-bold ${
              hasEmbeddings ? "text-green-600" : "text-red-600"
            }`}
          >
            {stats?.articlesWithEmbedding ?? 0}
          </p>
          {!hasEmbeddings && stats?.totalArticles > 0 && (
            <Badge variant="destructive" className="mt-2">
              ⚠️ Sem busca semântica
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <FolderTree className="h-5 w-5 text-violet-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Categorias
            </h3>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {stats?.totalCategories ?? 0}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Último Aprendizado
            </h3>
          </div>
          {stats?.lastUpdated ? (
            <>
              <p className="text-sm font-medium text-foreground">
                {formatDistanceToNow(stats.lastUpdated, {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
              <Badge
                variant={isRecent ? "default" : "secondary"}
                className="mt-2"
              >
                {isRecent ? "🟢 Cérebro Ativo" : "🟡 Atualização Pendente"}
              </Badge>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum documento ainda
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
