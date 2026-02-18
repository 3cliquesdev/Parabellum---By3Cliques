import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getStartOfDayString, getEndOfDayString } from "@/lib/dateUtils";
import { DateRange } from "react-day-picker";

export interface EmailSequenceRow {
  execution_id: string;
  contact_name: string;
  contact_email: string;
  playbook_name: string;
  sale_date: string;
  email_order: number;
  email_subject: string;
  email_sent_at: string | null;
  email_opened_at: string | null;
  email_clicked_at: string | null;
  email_bounced_at: string | null;
  email_status: string | null;
}

export interface EmailSequenceFilters {
  dateRange?: DateRange;
  playbookId?: string;
}

async function fetchAllPages(params: Record<string, any>): Promise<EmailSequenceRow[]> {
  const PAGE_SIZE = 1000;
  let allRows: EmailSequenceRow[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.rpc(
      "get_playbook_email_sequence_report" as any,
      params
    ).range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = (data as unknown as EmailSequenceRow[]) || [];
    allRows = allRows.concat(rows);
    hasMore = rows.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return allRows;
}

export function usePlaybookEmailSequenceReport() {
  const [data, setData] = useState<EmailSequenceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async (filters: EmailSequenceFilters) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filters.dateRange?.from) {
        params.p_start = getStartOfDayString(filters.dateRange.from);
      }
      if (filters.dateRange?.to) {
        params.p_end = getEndOfDayString(filters.dateRange.to);
      }
      if (filters.playbookId && filters.playbookId !== "all") {
        params.p_playbook_id = filters.playbookId;
      }

      const allRows = await fetchAllPages(params);
      setData(allRows);
    } catch (err: any) {
      console.error("Error fetching email sequence report:", err);
      toast.error("Erro ao buscar relatório: " + err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, fetchReport };
}
