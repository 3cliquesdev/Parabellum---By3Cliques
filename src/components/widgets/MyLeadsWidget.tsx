import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, TrendingUp } from "lucide-react";

interface MyLeadsWidgetProps {
  userId?: string;
}

export function MyLeadsWidget({ userId }: MyLeadsWidgetProps) {
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["my-leads", userId],
    queryFn: async () => {
      if (!userId) return null;

      // Buscar contatos atribuídos ao usuário
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("id, status, created_at")
        .eq("assigned_to", userId);

      if (error) throw error;

      // Buscar deals para calcular conversão
      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("status")
        .eq("assigned_to", userId);

      if (dealsError) throw dealsError;

      const newLeads = contacts?.filter((contact) => {
        const createdDate = new Date(contact.created_at);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return createdDate >= oneDayAgo;
      }).length || 0;

      const inNegotiation = contacts?.filter((c) => c.status === "qualified").length || 0;
      
      const totalLeads = contacts?.length || 0;
      const wonDeals = deals?.filter((d) => d.status === "won").length || 0;
      const conversionRate = totalLeads > 0 ? ((wonDeals / totalLeads) * 100).toFixed(1) : "0";

      return {
        newLeads,
        inNegotiation,
        totalLeads,
        conversionRate,
      };
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Meus Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Meus Leads
        </CardTitle>
        <CardDescription>Status dos seus leads</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Novos (24h)</p>
            <p className="text-2xl font-bold text-foreground">{leadsData?.newLeads || 0}</p>
          </div>
          <UserPlus className="h-8 w-8 text-primary" />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <p className="text-sm text-muted-foreground">Em Negociação</p>
            <p className="text-xl font-semibold text-foreground">{leadsData?.inNegotiation || 0}</p>
          </div>
          <TrendingUp className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
              <p className="text-xl font-semibold text-foreground">{leadsData?.conversionRate}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total de Leads</p>
              <p className="text-lg font-semibold text-foreground">{leadsData?.totalLeads || 0}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
