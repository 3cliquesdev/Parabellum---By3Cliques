import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, DollarSign, Ticket, MessageCircle, TrendingUp } from "lucide-react";

export function SystemMetricsCard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["super-admin-metrics"],
    queryFn: async () => {
      const [
        usersRes,
        contactsRes,
        dealsRes,
        ticketsRes,
        conversationsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id, is_blocked, is_archived", { count: "exact" }),
        supabase.from("contacts").select("id, status", { count: "exact" }),
        supabase.from("deals").select("id, status", { count: "exact" }),
        supabase.from("tickets").select("id, status", { count: "exact" }),
        supabase.from("conversations").select("id, status", { count: "exact" }),
      ]);

      const users = usersRes.data || [];
      const contacts = contactsRes.data || [];
      const deals = dealsRes.data || [];
      const tickets = ticketsRes.data || [];
      const conversations = conversationsRes.data || [];

      return {
        users: {
          total: users.length,
          active: users.filter(u => !u.is_blocked && !u.is_archived).length,
          blocked: users.filter(u => u.is_blocked).length,
        },
        contacts: {
          total: contacts.length,
          customers: contacts.filter(c => c.status === 'customer').length,
          leads: contacts.filter(c => c.status === 'lead').length,
        },
        deals: {
          total: deals.length,
          open: deals.filter(d => d.status === 'open').length,
          won: deals.filter(d => d.status === 'won').length,
        },
        tickets: {
          total: tickets.length,
          open: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        },
        conversations: {
          total: conversations.length,
          active: conversations.filter(c => c.status === 'open').length,
        },
      };
    },
    staleTime: 60 * 1000,
  });

  const MetricItem = ({ icon: Icon, label, value, subValue, color }: { 
    icon: any; 
    label: string; 
    value: number | string; 
    subValue?: string;
    color: string;
  }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{isLoading ? "..." : value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {subValue && <p className="text-xs text-primary">{subValue}</p>}
      </div>
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Métricas do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricItem 
          icon={Users} 
          label="Usuários" 
          value={metrics?.users.total || 0}
          subValue={`${metrics?.users.active || 0} ativos • ${metrics?.users.blocked || 0} bloqueados`}
          color="bg-blue-500"
        />
        <MetricItem 
          icon={Building2} 
          label="Contatos" 
          value={metrics?.contacts.total || 0}
          subValue={`${metrics?.contacts.customers || 0} clientes • ${metrics?.contacts.leads || 0} leads`}
          color="bg-green-500"
        />
        <MetricItem 
          icon={DollarSign} 
          label="Negócios" 
          value={metrics?.deals.total || 0}
          subValue={`${metrics?.deals.open || 0} abertos • ${metrics?.deals.won || 0} ganhos`}
          color="bg-amber-500"
        />
        <MetricItem 
          icon={Ticket} 
          label="Tickets" 
          value={metrics?.tickets.total || 0}
          subValue={`${metrics?.tickets.open || 0} abertos`}
          color="bg-purple-500"
        />
        <MetricItem 
          icon={MessageCircle} 
          label="Conversas" 
          value={metrics?.conversations.total || 0}
          subValue={`${metrics?.conversations.active || 0} ativas`}
          color="bg-indigo-500"
        />
      </CardContent>
    </Card>
  );
}
