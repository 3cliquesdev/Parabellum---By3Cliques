import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ConsultantDistribution {
  consultant_id: string;
  consultant_name: string;
  avatar_url: string | null;
  total_clients: number;
  active_clients: number;
  churned_clients: number;
  leads: number;
  first_assignment: string | null;
  last_assignment: string | null;
}

export interface LinkedClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  consultant_id: string;
  consultant_name: string;
  created_at: string;
  last_contact_date: string | null;
}

export interface DistributionStats {
  total_linked: number;
  total_unlinked: number;
  total_consultants: number;
  avg_per_consultant: number;
}

export function useConsultantDistributionReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estatísticas gerais
  const statsQuery = useQuery({
    queryKey: ["consultant-distribution-stats"],
    queryFn: async (): Promise<DistributionStats> => {
      // Total de clientes vinculados
      const { count: linkedCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("status", "customer")
        .not("consultant_id", "is", null);

      // Total de clientes NÃO vinculados
      const { count: unlinkedCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("status", "customer")
        .is("consultant_id", null);

      // Total de consultores ativos
      const { data: consultants } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "consultant");

      const totalConsultants = consultants?.length || 0;
      const totalLinked = linkedCount || 0;

      return {
        total_linked: totalLinked,
        total_unlinked: unlinkedCount || 0,
        total_consultants: totalConsultants,
        avg_per_consultant: totalConsultants > 0 ? Math.round(totalLinked / totalConsultants) : 0,
      };
    },
  });

  // Distribuição por consultor
  const byConsultantQuery = useQuery({
    queryKey: ["consultant-distribution-by-consultant"],
    queryFn: async (): Promise<ConsultantDistribution[]> => {
      // Buscar consultores
      const { data: consultantRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "consultant");

      if (!consultantRoles?.length) return [];

      const consultantIds = consultantRoles.map((r) => r.user_id);

      // Buscar perfis
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", consultantIds);

      const results: ConsultantDistribution[] = [];

      for (const profile of profiles || []) {
        // Contar clientes por status
        const { data: clients } = await supabase
          .from("contacts")
          .select("id, status, created_at")
          .eq("consultant_id", profile.id);

        const clientList = clients || [];
        const activeClients = clientList.filter((c) => c.status === "customer").length;
        const churnedClients = clientList.filter((c) => c.status === "churned").length;
        const leads = clientList.filter((c) => c.status === "lead").length;

        const dates = clientList
          .map((c) => new Date(c.created_at).getTime())
          .filter((d) => !isNaN(d));

        results.push({
          consultant_id: profile.id,
          consultant_name: profile.full_name || "Sem nome",
          avatar_url: profile.avatar_url,
          total_clients: clientList.length,
          active_clients: activeClients,
          churned_clients: churnedClients,
          leads,
          first_assignment: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
          last_assignment: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
        });
      }

      return results.sort((a, b) => b.total_clients - a.total_clients);
    },
  });

  // Clientes vinculados
  const linkedClientsQuery = useQuery({
    queryKey: ["consultant-distribution-linked-clients"],
    queryFn: async (): Promise<LinkedClient[]> => {
      const { data: clients } = await supabase
        .from("contacts")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          consultant_id,
          created_at,
          last_contact_date
        `)
        .eq("status", "customer")
        .not("consultant_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (!clients?.length) return [];

      // Buscar nomes dos consultores
      const consultantIds = [...new Set(clients.map((c) => c.consultant_id).filter(Boolean))] as string[];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", consultantIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);

      return clients.map((c) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone,
        status: c.status || "customer",
        consultant_id: c.consultant_id!,
        consultant_name: profileMap.get(c.consultant_id!) || "Desconhecido",
        created_at: c.created_at,
        last_contact_date: c.last_contact_date,
      }));
    },
  });

  // Clientes não vinculados
  const unlinkedClientsQuery = useQuery({
    queryKey: ["consultant-distribution-unlinked-clients"],
    queryFn: async () => {
      const { data, count } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, created_at, source", { count: "exact" })
        .eq("status", "customer")
        .is("consultant_id", null)
        .order("created_at", { ascending: false })
        .limit(100);

      return { clients: data || [], total: count || 0 };
    },
  });

  // Mutação para distribuir em lote
  const distributeBatchMutation = useMutation({
    mutationFn: async (limit: number = 100) => {
      const { data, error } = await supabase.rpc("distribute_unassigned_customers_batch", {
        p_limit: limit,
      });

      if (error) throw error;
      return data as { success: boolean; message: string; assigned_count: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Distribuição concluída",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["consultant-distribution"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na distribuição",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    byConsultant: byConsultantQuery.data || [],
    isLoadingByConsultant: byConsultantQuery.isLoading,
    linkedClients: linkedClientsQuery.data || [],
    isLoadingLinkedClients: linkedClientsQuery.isLoading,
    unlinkedClients: unlinkedClientsQuery.data?.clients || [],
    unlinkedTotal: unlinkedClientsQuery.data?.total || 0,
    isLoadingUnlinked: unlinkedClientsQuery.isLoading,
    distributeBatch: distributeBatchMutation.mutate,
    isDistributing: distributeBatchMutation.isPending,
  };
}
