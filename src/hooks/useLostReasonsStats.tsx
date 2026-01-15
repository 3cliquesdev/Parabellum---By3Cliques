import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface LostReasonStat {
  reason: string;
  reasonLabel: string;
  count: number;
  totalValue: number;
}

const REASON_LABELS: Record<string, string> = {
  preco: "Preço",
  concorrente: "Escolheu concorrente",
  sem_interesse_produto: "Não tinha interesse em nenhum produto",
  sem_interesse_momento: "Sem interesse no momento",
  sem_interesse_dropshipping: "Não tinha interesse em fazer dropshipping",
  parou_interagir: "Parou de interagir",
  nunca_respondeu: "Nunca respondeu",
  ja_comprou_outro: "Já comprou de outro",
  ja_comprou_duplicidade: "Já comprou/Duplicidade",
  reembolsado: "Reembolsado",
  estorno: "Estorno/Chargeback",
  migracao_pagamento_anterior: "Migração (pagamento anterior)",
  outro: "Outro",
  contato_invalido: "Contato inválido",
  compra_futura: "Compra futura",
  nicho_fora_catalogo: "Nicho fora do catálogo",
  prazo_importacao: "Prazo de importação",
  confianca_geral: "Confiança na marca - geral",
  confianca_entrega: "Confiança na marca - entrega",
  confianca_redes: "Confiança na marca - redes sociais",
  investimento_hibrido: "Investimento para o híbrido",
  fora_momento: "Fora do momento de compra",
  desistiu_queda_vendas: "Desistiu - queda de vendas",
};

export function useLostReasonsStats() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["lost-reasons-stats", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("lost_reason, value, currency")
        .eq("status", "lost")
        .not("lost_reason", "is", null);

      // Filtrar por assigned_to se for sales_rep
      if (role && (role as string) === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por lost_reason
      const grouped = (data || []).reduce((acc, deal) => {
        const reason = deal.lost_reason || "Sem motivo";
        if (!acc[reason]) {
          acc[reason] = { count: 0, totalValue: 0 };
        }
        acc[reason].count++;
        acc[reason].totalValue += deal.value || 0;
        return acc;
      }, {} as Record<string, { count: number; totalValue: number }>);

      const stats: LostReasonStat[] = Object.entries(grouped)
        .map(([reason, stats]) => ({ 
          reason, 
          reasonLabel: REASON_LABELS[reason] || reason,
          ...stats 
        }))
        .sort((a, b) => b.count - a.count);

      return stats;
    },
  });
}
