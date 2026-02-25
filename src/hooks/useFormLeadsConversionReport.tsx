import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format, eachDayOfInterval, parseISO } from "date-fns";

interface DailyData {
  date: string;
  leads: number;
  won: number;
  lost: number;
  conversionRate: number;
  revenue: number;
}

interface KPIs {
  totalLeads: number;
  totalWon: number;
  totalLost: number;
  conversionRate: number;
  totalRevenue: number;
}

export interface DetailedRow {
  submissionDate: string;
  closingDate: string | null;
  contactName: string;
  formName: string;
  dealStatus: string | null;
  dealValue: number | null;
}

export function useFormLeadsConversionReport(dateRange: DateRange | undefined, formId?: string) {
  const startDate = dateRange?.from?.toISOString() ?? "";
  const endDate = dateRange?.to?.toISOString() ?? "";

  const leadsQuery = useQuery({
    queryKey: ["form-leads-report", "leads", startDate, endDate, formId],
    queryFn: async () => {
      let query = supabase
        .from("form_submissions")
        .select("id, created_at, form_id")
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      if (formId) query = query.eq("form_id", formId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!startDate && !!endDate,
  });

  const wonQuery = useQuery({
    queryKey: ["form-leads-report", "won", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, closed_at, value")
        .eq("lead_source", "formulario")
        .eq("status", "won")
        .gte("closed_at", startDate)
        .lte("closed_at", endDate);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!startDate && !!endDate,
  });

  const lostQuery = useQuery({
    queryKey: ["form-leads-report", "lost", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, closed_at")
        .eq("lead_source", "formulario")
        .eq("status", "lost")
        .gte("closed_at", startDate)
        .lte("closed_at", endDate);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!startDate && !!endDate,
  });

  // Detailed query: form_submissions with contact and form name
  const detailedSubmissionsQuery = useQuery({
    queryKey: ["form-leads-report", "detailed-submissions", startDate, endDate, formId],
    queryFn: async () => {
      let query = supabase
        .from("form_submissions")
        .select(`
          id, created_at, form_id, contact_id,
          contacts!form_submissions_contact_id_fkey(id, first_name, last_name),
          forms!form_submissions_form_id_fkey(name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      if (formId) query = query.eq("form_id", formId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!startDate && !!endDate,
  });

  // Deals for detailed view (all statuses)
  const detailedDealsQuery = useQuery({
    queryKey: ["form-leads-report", "detailed-deals", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, contact_id, status, closed_at, value")
        .eq("lead_source", "formulario");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!startDate && !!endDate,
  });

  const isLoading = leadsQuery.isLoading || wonQuery.isLoading || lostQuery.isLoading || detailedSubmissionsQuery.isLoading || detailedDealsQuery.isLoading;

  const { dailyData, kpis } = (() => {
    if (!dateRange?.from || !dateRange?.to || !leadsQuery.data || !wonQuery.data || !lostQuery.data) {
      return {
        dailyData: [] as DailyData[],
        kpis: { totalLeads: 0, totalWon: 0, totalLost: 0, conversionRate: 0, totalRevenue: 0 } as KPIs,
      };
    }

    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const leadsMap: Record<string, number> = {};
    const wonMap: Record<string, { count: number; revenue: number }> = {};
    const lostMap: Record<string, number> = {};

    for (const l of leadsQuery.data) {
      const d = format(parseISO(l.created_at), "yyyy-MM-dd");
      leadsMap[d] = (leadsMap[d] ?? 0) + 1;
    }
    for (const w of wonQuery.data) {
      if (!w.closed_at) continue;
      const d = format(parseISO(w.closed_at), "yyyy-MM-dd");
      if (!wonMap[d]) wonMap[d] = { count: 0, revenue: 0 };
      wonMap[d].count++;
      wonMap[d].revenue += Number(w.value ?? 0);
    }
    for (const l of lostQuery.data) {
      if (!l.closed_at) continue;
      const d = format(parseISO(l.closed_at), "yyyy-MM-dd");
      lostMap[d] = (lostMap[d] ?? 0) + 1;
    }

    const totalLeads = leadsQuery.data.length;
    const totalWon = wonQuery.data.length;
    const totalLost = lostQuery.data.length;
    const totalRevenue = wonQuery.data.reduce((s, w) => s + Number(w.value ?? 0), 0);

    const dailyData: DailyData[] = days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const leads = leadsMap[key] ?? 0;
      const won = wonMap[key]?.count ?? 0;
      const lost = lostMap[key] ?? 0;
      const revenue = wonMap[key]?.revenue ?? 0;
      return {
        date: key,
        leads,
        won,
        lost,
        conversionRate: leads > 0 ? Math.round((won / leads) * 100) : 0,
        revenue,
      };
    });

    return {
      dailyData,
      kpis: {
        totalLeads,
        totalWon,
        totalLost,
        conversionRate: totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0,
        totalRevenue,
      },
    };
  })();

  // Build detailed data
  const detailedData: DetailedRow[] = (() => {
    if (!detailedSubmissionsQuery.data || !detailedDealsQuery.data) return [];

    // Group deals by contact_id
    const dealsByContact: Record<string, { status: string; closed_at: string | null; value: number | null }> = {};
    for (const deal of detailedDealsQuery.data) {
      if (deal.contact_id) {
        // Keep the most recent deal per contact
        if (!dealsByContact[deal.contact_id] || (deal.closed_at && (!dealsByContact[deal.contact_id].closed_at || deal.closed_at > dealsByContact[deal.contact_id].closed_at))) {
          dealsByContact[deal.contact_id] = {
            status: deal.status,
            closed_at: deal.closed_at,
            value: deal.value != null ? Number(deal.value) : null,
          };
        }
      }
    }

    return detailedSubmissionsQuery.data.map((sub: any) => {
      const contact = sub.contacts;
      const form = sub.forms;
      const contactId = sub.contact_id;
      const deal = contactId ? dealsByContact[contactId] : null;

      return {
        submissionDate: sub.created_at ?? "",
        closingDate: deal?.closed_at ?? null,
        contactName: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "—",
        formName: form?.name ?? "—",
        dealStatus: deal?.status ?? null,
        dealValue: deal?.value ?? null,
      };
    }).sort((a: DetailedRow, b: DetailedRow) => b.submissionDate.localeCompare(a.submissionDate));
  })();

  return { dailyData, kpis, detailedData, isLoading };
}
