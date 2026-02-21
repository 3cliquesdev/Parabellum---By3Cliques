import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Dashboard = Database['public']['Tables']['dashboards']['Row'];
type DashboardBlock = Database['public']['Tables']['dashboard_blocks']['Row'];

export function useDashboardsList() {
  return useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Dashboard[];
    },
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("dashboards")
        .insert({ name, description: description || null, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Dashboard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      toast.success("Dashboard criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dashboards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      toast.success("Dashboard excluído.");
    },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });
}

export function useDashboardBlocks(dashboardId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-blocks", dashboardId],
    enabled: !!dashboardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_blocks")
        .select("*")
        .eq("dashboard_id", dashboardId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DashboardBlock[];
    },
  });
}

export function useAddBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dashboard_id,
      report_id,
      visualization_type,
      title,
      sort_order,
    }: {
      dashboard_id: string;
      report_id: string;
      visualization_type: string;
      title?: string;
      sort_order?: number;
    }) => {
      const { data, error } = await supabase
        .from("dashboard_blocks")
        .insert({
          dashboard_id,
          report_id,
          visualization_type,
          title: title || null,
          position_x: 0,
          position_y: 0,
          width: 1,
          height: 1,
          sort_order: sort_order ?? 0,
          config_json: {},
        })
        .select()
        .single();
      if (error) throw error;
      return data as DashboardBlock;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dashboard-blocks", vars.dashboard_id] });
      toast.success("Bloco adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dashboard_id }: { id: string; dashboard_id: string }) => {
      const { error } = await supabase.from("dashboard_blocks").delete().eq("id", id);
      if (error) throw error;
      return dashboard_id;
    },
    onSuccess: (dashboardId) => {
      qc.invalidateQueries({ queryKey: ["dashboard-blocks", dashboardId] });
      toast.success("Bloco removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReportDefinitions() {
  return useQuery({
    queryKey: ["report-definitions-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_definitions")
        .select("id, name, description")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
