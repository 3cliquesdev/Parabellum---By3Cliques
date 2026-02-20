import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReportQueryResult {
  rows: Record<string, unknown>[];
  has_more: boolean;
}

export function useReportQuery() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportQueryResult | null>(null);

  const execute = async (params: {
    report_id?: string;
    definition_inline?: any;
    limit?: number;
    offset?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("report-query-engine", {
        body: params,
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setResult(data as ReportQueryResult);
      return data as ReportQueryResult;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error, result };
}
