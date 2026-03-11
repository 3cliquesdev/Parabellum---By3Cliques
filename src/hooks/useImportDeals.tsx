import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface DealRow {
  title: string;
  value?: string | number;
  email_contato?: string;
  telefone_contato?: string;
  produto?: string;
  assigned_to?: string;
  expected_close_date?: string;
  external_order_id?: string;
  lead_source?: string;
  status?: string;
}

interface ImportResult {
  deals_created: number;
  contacts_created: number;
  contacts_reused: number;
  vendor_not_found: Array<{ row: number; title: string; vendor_name: string }>;
  product_not_found: Array<{ row: number; title: string; product_name: string }>;
  errors: Array<{ row: number; title: string; error: string }>;
}

const CHUNK_SIZE = 50;

export function useImportDeals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const mutation = useMutation({
    mutationFn: async ({
      deals,
      pipeline_id,
      stage_id,
    }: {
      deals: DealRow[];
      pipeline_id: string;
      stage_id: string;
    }): Promise<ImportResult> => {
      const total = deals.length;
      setProgress({ current: 0, total });

      const result: ImportResult = { deals_created: 0, contacts_created: 0, contacts_reused: 0, vendor_not_found: [], product_not_found: [], errors: [] };

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = deals.slice(i, i + CHUNK_SIZE);
        try {
          const { data, error } = await supabase.functions.invoke('import-deals', {
            body: { deals: chunk, pipeline_id, stage_id },
          });
          if (error) throw error;
          const chunkResult = data as ImportResult;
          result.deals_created += chunkResult.deals_created;
          result.contacts_created += chunkResult.contacts_created;
          result.contacts_reused += chunkResult.contacts_reused || 0;
          // Adjust row numbers for chunk offset
          (chunkResult.vendor_not_found || []).forEach(v => {
            result.vendor_not_found.push({ ...v, row: v.row + i });
          });
          (chunkResult.product_not_found || []).forEach(p => {
            result.product_not_found.push({ ...p, row: p.row + i });
          });
          chunkResult.errors.forEach(e => {
            result.errors.push({ ...e, row: e.row + i });
          });
        } catch (err: any) {
          chunk.forEach((d, idx) => {
            result.errors.push({ row: i + idx + 1, title: d.title || '', error: err.message });
          });
        }
        setProgress({ current: Math.min(i + CHUNK_SIZE, total), total });
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast({
        title: "Importação de deals concluída",
        description: `${result.deals_created} deals criados, ${result.contacts_created} contatos criados${result.errors.length > 0 ? `, ${result.errors.length} erros` : ''}`,
      });
      setProgress({ current: 0, total: 0 });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
      setProgress({ current: 0, total: 0 });
    },
  });

  return { ...mutation, progress };
}
