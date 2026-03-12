import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { BarChart3, LayoutDashboard, TrendingUp, FileText, Sparkles, UserPlus, TicketCheck, MessageSquare, DollarSign } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const hubCards = [
  {
    title: "Dashboards Dinâmicos",
    description: "Crie e gerencie painéis personalizados com blocos de dados em tempo real.",
    icon: LayoutDashboard,
    href: "/dashboards",
  },
  {
    title: "Dashboard de Vendas",
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
    description: "Painel premium com métricas avançadas, churn, performance e suporte.",
    icon: Sparkles,
    href: "/analytics/premium",
  },
];

const eventIcons: Record<string, { icon: typeof UserPlus; color: string }> = {
  contact: { icon: UserPlus, color: "text-info" },
  ticket: { icon: TicketCheck, color: "text-warning" },
  conversation: { icon: MessageSquare, color: "text-primary" },
  deal: { icon: DollarSign, color: "text-success" },
};

function useRecentActivity() {
  return useQuery({
    queryKey: ["recent-activity-timeline"],
    queryFn: async () => {
      const [contacts, tickets] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, first_name, last_name, created_at")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("tickets")
          .select("id, subject, created_at, ticket_number")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const events = [
        ...(contacts.data || []).map((c) => ({
          id: c.id,
          type: "contact" as const,
          label: `Novo contato: ${c.first_name} ${c.last_name}`,
          time: c.created_at,
        })),
        ...(tickets.data || []).map((t) => ({
          id: t.id,
          type: "ticket" as const,
          label: `Ticket #${t.ticket_number}: ${t.subject}`,
          time: t.created_at,
        })),
      ];

      return events
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5);
    },
    staleTime: 60_000,
  });
}

export default function Analytics() {
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();

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
      <div className="space-y-6 min-w-0 max-w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shadow-sm">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Hub</h1>
            <p className="text-sm text-muted-foreground">
              Centro de inteligência e dados do seu negócio
            </p>
          </div>
        </div>

        {/* Navigation Cards - Compact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {hubCards.map((card) => (
            <Link key={card.href} to={card.href} className="group">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 group-hover:-translate-y-0.5">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 mb-2">
                    <card.icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm">{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <CardDescription className="text-xs">{card.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atividade Recente</CardTitle>
            <CardDescription>Últimos eventos do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !recentActivity?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((event) => {
                  const config = eventIcons[event.type] || eventIcons.contact;
                  const EventIcon = config.icon;
                  return (
                    <div key={event.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <EventIcon className={`h-4 w-4 flex-shrink-0 ${config.color}`} />
                      <span className="text-sm text-foreground flex-1 truncate">{event.label}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(event.time), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
