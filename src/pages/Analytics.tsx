import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { BarChart3, LayoutDashboard, TrendingUp, FileText, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const hubCards = [
  {
    title: "Dashboards Dinâmicos",
    description: "Crie e gerencie painéis personalizados com blocos de dados em tempo real.",
    icon: LayoutDashboard,
    href: "/dashboards",
  },
  {
    title: "Dashboard de Vendas (Sistema)",
    description: "Dashboard legado de vendas com métricas consolidadas do sistema.",
    icon: TrendingUp,
    href: "/?tab=vendas",
  },
  {
    title: "Report Builder",
    description: "Monte relatórios customizados com queries visuais e exportação.",
    icon: FileText,
    href: "/report-builder",
  },
  {
    title: "Analytics Premium",
    description: "Painel premium com todas as métricas avançadas, churn, performance e suporte.",
    icon: Sparkles,
    href: "/analytics/premium",
  },
];

export default function Analytics() {
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && role !== null && role === 'sales_rep') {
      navigate('/');
    }
  }, [roleLoading, role, navigate]);

  if (roleLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (role === 'sales_rep') return null;

  return (
    <div className="container mx-auto p-6 min-w-0 max-w-full overflow-x-hidden bg-slate-50/50 dark:bg-background">
      <div className="space-y-8 min-w-0 max-w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shadow-sm">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Hub</h1>
            <p className="text-sm text-muted-foreground">
              Centro de inteligência e dados do seu negócio
            </p>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {hubCards.map((card) => (
            <Link key={card.href} to={card.href} className="group">
              <Card className="h-full transition-all hover:shadow-lg hover:border-primary/30 group-hover:-translate-y-0.5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 mb-3">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
