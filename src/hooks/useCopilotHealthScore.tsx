import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface CopilotHealthScore {
  total_conversations: number;
  copilot_active_count: number;
  copilot_adoption_rate: number;
  avg_resolution_time_with_copilot: number;
  avg_resolution_time_without_copilot: number;
  resolution_improvement_percent: number;
  avg_csat_with_copilot: number;
  avg_csat_without_copilot: number;
  csat_improvement_percent: number;
  kb_gap_count: number;
  kb_coverage_rate: number;
  suggestions_used_total: number;
  suggestions_available_total: number;
  suggestion_usage_rate: number;
  health_score: number;
  // Componentes explicáveis (0-25 pts cada)
  adoption_component: number;
  kb_component: number;
  csat_component: number;
  usage_component: number;
  data_quality: 'alta' | 'média' | 'baixa';
}

export interface MonthlyEvolution {
  month: string;
  month_date?: string;
  copilot_active_count: number;
  total_conversations: number;
  adoption_rate: number;
  avg_resolution_time: number;
  avg_csat: number;
  kb_gaps_created: number;
}

export interface CopilotComparison {
  group_label: string;
  total_conversations: number;
  avg_resolution_seconds: number;
  avg_csat: number;
  avg_suggestions_used: number;
}

export interface KBGapByCategory {
  category: string;
  gap_count: number;
  total_conversations: number;
  gap_rate: number;
}

export function useCopilotHealthScore(period: number = 30, departmentId?: string) {
  return useQuery({
    queryKey: ["copilot-health-score", period, departmentId],
    queryFn: async () => {
      const startDate = subDays(new Date(), period).toISOString();
      const endDate = new Date().toISOString();

      const { data, error } = await supabase.rpc("get_copilot_health_score", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_department_id: departmentId || null,
      });

      if (error) {
        console.error("[useCopilotHealthScore] Erro:", error);
        throw error;
      }

      return (data?.[0] as CopilotHealthScore) || null;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useCopilotMonthlyEvolution(months: number = 6, departmentId?: string) {
  return useQuery({
    queryKey: ["copilot-monthly-evolution", months, departmentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_copilot_monthly_evolution", {
        p_months: months,
        p_department_id: departmentId || null,
      });

      if (error) {
        console.error("[useCopilotMonthlyEvolution] Erro:", error);
        throw error;
      }

      return (data as MonthlyEvolution[]) || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCopilotComparison(period: number = 30) {
  return useQuery({
    queryKey: ["copilot-comparison", period],
    queryFn: async () => {
      const startDate = subDays(new Date(), period).toISOString();
      const endDate = new Date().toISOString();

      const { data, error } = await supabase.rpc("get_copilot_comparison", {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        console.error("[useCopilotComparison] Erro:", error);
        throw error;
      }

      return (data as CopilotComparison[]) || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useKBGapsByCategory(period: number = 30) {
  return useQuery({
    queryKey: ["kb-gaps-by-category", period],
    queryFn: async () => {
      const startDate = subDays(new Date(), period).toISOString();
      const endDate = new Date().toISOString();

      const { data, error } = await supabase.rpc("get_kb_gaps_by_category", {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        console.error("[useKBGapsByCategory] Erro:", error);
        throw error;
      }

      return (data as KBGapByCategory[]) || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}
