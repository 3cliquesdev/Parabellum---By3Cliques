import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export function useReportDefinitions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["report-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_definitions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      base_entity: string;
      fields: any[];
      metrics: any[];
      filters: any[];
      groupings: any[];
    }) => {
      const { data: report, error: repErr } = await supabase
        .from("report_definitions")
        .insert({
          name: params.name,
          description: params.description || null,
          base_entity: params.base_entity,
          created_by: user?.id,
        })
        .select()
        .single();
      if (repErr) throw repErr;

      const reportId = report.id;

      if (params.fields.length > 0) {
        const { error } = await supabase.from("report_fields").insert(
          params.fields.map((f, i) => ({
            report_id: reportId,
            entity: f.entity,
            field_name: f.field_name,
            alias: f.alias || null,
            sort_order: i,
          }))
        );
        if (error) throw error;
      }

      if (params.metrics.length > 0) {
        const { error } = await supabase.from("report_metrics").insert(
          params.metrics.map((m, i) => ({
            report_id: reportId,
            entity: m.entity,
            field_name: m.field_name,
            aggregation_type: m.aggregation,
            metric_name: m.alias || `${m.aggregation}_${m.field_name}`,
            sort_order: i,
          }))
        );
        if (error) throw error;
      }

      if (params.filters.length > 0) {
        const { error } = await supabase.from("report_filters").insert(
          params.filters.map((f) => ({
            report_id: reportId,
            entity: f.entity,
            field_name: f.field_name,
            operator: f.operator,
            value: f.value !== undefined ? String(f.value) : null,
          }))
        );
        if (error) throw error;
      }

      if (params.groupings.length > 0) {
        const { error } = await supabase.from("report_groupings").insert(
          params.groupings.map((g, i) => ({
            report_id: reportId,
            entity: g.entity,
            field_name: g.field_name,
            time_grain: g.time_grain || null,
            sort_order: i,
          }))
        );
        if (error) throw error;
      }

      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-definitions"] });
      toast.success("Relatório salvo com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar relatório: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-definitions"] });
      toast.success("Relatório excluído!");
    },
  });

  return {
    reports: listQuery,
    save: saveMutation,
    remove: deleteMutation,
  };
}
