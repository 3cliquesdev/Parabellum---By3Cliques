import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

export interface TicketExportRow {
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  assigned_to_name: string;
  requesting_department_name: string;
  department_name: string;
  operation_name: string;
  origin_name: string;
  channel: string;
  created_at: string;
  resolved_at: string | null;
  due_date: string | null;
  first_response_at: string | null;
  frt_minutes: number | null;
  resolution_minutes: number | null;
  sla_response_time_value: number | null;
  sla_response_time_unit: string | null;
  sla_resolution_time_value: number | null;
  sla_resolution_time_unit: string | null;
  tags_list: string | null;
  total_count: number;
}

export interface TicketExportFilters {
  dateRange: DateRange | undefined;
  departmentId: string;
  agentIds: string[];
  status: string;
  priority: string;
  search: string;
}

export function useTicketsExportReport(filters: TicketExportFilters, page: number) {
  const limit = 50;
  const offset = page * limit;

  const query = useQuery({
    queryKey: ["tickets-export-report", filters, page],
    queryFn: async () => {
      const params: Record<string, any> = {
        p_limit: limit,
        p_offset: offset,
      };

      if (filters.dateRange?.from) {
        const d = filters.dateRange.from;
        params.p_start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T00:00:00`;
      }
      if (filters.dateRange?.to) {
        const d = filters.dateRange.to;
        params.p_end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T23:59:59`;
      }
      if (filters.departmentId && filters.departmentId !== "all") params.p_department_id = filters.departmentId;
      if (filters.agentIds && filters.agentIds.length > 0) params.p_agent_ids = filters.agentIds;
      if (filters.status && filters.status !== "all") params.p_status = filters.status;
      if (filters.priority && filters.priority !== "all") params.p_priority = filters.priority;
      if (filters.search) params.p_search = filters.search;

      const { data, error } = await supabase.rpc("get_tickets_export_report", params);
      if (error) throw error;
      return (data as unknown as TicketExportRow[]) || [];
    },
  });

  const totalCount = query.data?.[0]?.total_count ?? 0;

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
  };
}
