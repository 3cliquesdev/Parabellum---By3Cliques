import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ShoppingCart, Package, GraduationCap, Database, Wrench, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useKnowledgeStats } from "@/hooks/useKnowledgeStats";
import { useKiwifyStats } from "@/hooks/useKiwifyStats";
import { useSandboxTrainingCount } from "@/hooks/useSandboxTrainingCount";
import { Skeleton } from "@/components/ui/skeleton";

interface KnowledgeSource {
  id: string;
  name: string;
  icon: React.ElementType;
  database: string;
  tool: string;
  description: string;
  link: string;
  color: string;
}

const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    id: "knowledge_articles",
    name: "Base de Conhecimento",
    icon: BookOpen,
    database: "Supabase: knowledge_articles",
    tool: "Busca semântica (embeddings)",
    description: "FAQ, políticas, procedimentos",
    link: "/knowledge",
    color: "text-blue-500",
  },
  {
    id: "kiwify",
    name: "Kiwify (Vendas/Financeiro)",
    icon: ShoppingCart,
    database: "Supabase: contacts + deals",
    tool: "check_order_status",
    description: "Dados de compra, valores, status de venda",
    link: "/settings/kiwify",
    color: "text-orange-500",
  },
  {
    id: "tracking",
    name: "Rastreio de Pedidos (Logística)",
    icon: Package,
    database: "MySQL Externo: tabela parcel",
    tool: "check_tracking",
    description: "Status de envio, data de embalagem",
    link: "/settings",
    color: "text-purple-500",
  },
  {
    id: "sandbox",
    name: "Treinamento Sandbox",
    icon: GraduationCap,
    database: "Supabase: knowledge_articles (source=sandbox)",
    tool: "Busca semântica",
    description: "Regras aprendidas via correção manual",
    link: "/knowledge?source=sandbox_training",
    color: "text-emerald-500",
  },
];

export function KnowledgeSourcesWidget() {
  const navigate = useNavigate();
  const { data: kbStats, isLoading: kbLoading } = useKnowledgeStats();
  const { data: kiwifyStats, isLoading: kiwifyLoading } = useKiwifyStats();
  const { data: sandboxCount, isLoading: sandboxLoading } = useSandboxTrainingCount();

  const getSourceStats = (sourceId: string) => {
    switch (sourceId) {
      case "knowledge_articles":
        return kbLoading ? null : `${kbStats?.totalArticles || 0} artigos | ${kbStats?.articlesWithEmbedding || 0} com embedding`;
      case "kiwify":
        return kiwifyLoading ? null : `${kiwifyStats?.contacts || 0} clientes | ${kiwifyStats?.deals || 0} deals`;
      case "tracking":
        return "Consulta em tempo real via MySQL";
      case "sandbox":
        return sandboxLoading ? null : `${sandboxCount || 0} regras aprendidas`;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>Fontes de Conhecimento</CardTitle>
        </div>
        <CardDescription>
          Dados e integrações que a IA usa para responder perguntas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {KNOWLEDGE_SOURCES.map((source) => {
          const Icon = source.icon;
          const stats = getSourceStats(source.id);
          const isLoading = stats === null;

          return (
            <div
              key={source.id}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex gap-3">
                <div className={`p-2 rounded-lg bg-muted ${source.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-foreground">{source.name}</h4>
                  <p className="text-sm text-muted-foreground">{source.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      <Database className="h-3 w-3 mr-1" />
                      {source.database}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-normal">
                      <Wrench className="h-3 w-3 mr-1" />
                      {source.tool}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    {isLoading ? (
                      <Skeleton className="h-4 w-40" />
                    ) : (
                      <p className="text-xs text-muted-foreground">{stats}</p>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(source.link)}
                className="shrink-0"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Gerenciar
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
