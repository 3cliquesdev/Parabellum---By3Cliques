import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfMonth, endOfMonth } from "date-fns";

export interface CommissionData {
  meta_renovacao: number; // Total esperado de renovações
  renovado: number; // Total já renovado
  percentual_atingido: number;
  comissao_estimada: number;
  falta_para_meta: number;
  clientes_renovados: number;
  clientes_pendentes: number;
}

const COMMISSION_RATE = 0.05; // 5% de comissão

export function useCommissionTracker() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["commission-tracker", user?.id],
    queryFn: async () => {
      if (!user) return null;

      console.log("💰 useCommissionTracker: Calculating commission");

      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      // Buscar todos os clientes do consultor
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, subscription_plan, next_payment_date, last_payment_date")
        .eq("consultant_id", user.id)
        .eq("status", "customer");

      if (contactsError) {
        console.error("❌ Error fetching contacts:", contactsError);
        throw contactsError;
      }

      if (!contacts || contacts.length === 0) {
        console.log("⚠️ No contacts found");
        return {
          meta_renovacao: 0,
          renovado: 0,
          percentual_atingido: 0,
          comissao_estimada: 0,
          falta_para_meta: 0,
          clientes_renovados: 0,
          clientes_pendentes: 0,
        };
      }

      // Função auxiliar para converter plano em valor
      const getPlanValue = (plan: string | null): number => {
        if (!plan) return 0;
        const planLower = plan.toLowerCase();
        
        // Extrair valor do plano se estiver no formato "R$ 100" ou "100"
        const match = plan.match(/\d+/);
        if (match) return parseFloat(match[0]);
        
        // Valores padrão por categoria de plano
        if (planLower.includes("básico") || planLower.includes("basico")) return 50;
        if (planLower.includes("padrão") || planLower.includes("padrao") || planLower.includes("standard")) return 100;
        if (planLower.includes("premium") || planLower.includes("pro")) return 200;
        if (planLower.includes("enterprise") || planLower.includes("empresarial")) return 500;
        
        return 100; // Valor padrão
      };

      // Calcular meta de renovação (clientes com next_payment_date neste mês)
      const clientesPendentes = contacts.filter(c => {
        if (!c.next_payment_date) return false;
        const nextPayment = new Date(c.next_payment_date);
        return nextPayment >= monthStart && nextPayment <= monthEnd;
      });

      const meta_renovacao = clientesPendentes.reduce((sum, c) => {
        return sum + getPlanValue(c.subscription_plan);
      }, 0);

      // Calcular renovado (clientes que pagaram este mês)
      const clientesRenovados = contacts.filter(c => {
        if (!c.last_payment_date) return false;
        const lastPayment = new Date(c.last_payment_date);
        return lastPayment >= monthStart && lastPayment <= monthEnd;
      });

      const renovado = clientesRenovados.reduce((sum, c) => {
        return sum + getPlanValue(c.subscription_plan);
      }, 0);

      // Calcular métricas
      const percentual_atingido = meta_renovacao > 0 
        ? Math.round((renovado / meta_renovacao) * 100)
        : 0;

      const comissao_estimada = renovado * COMMISSION_RATE;
      const falta_para_meta = Math.max(0, meta_renovacao - renovado);

      const result: CommissionData = {
        meta_renovacao,
        renovado,
        percentual_atingido,
        comissao_estimada,
        falta_para_meta,
        clientes_renovados: clientesRenovados.length,
        clientes_pendentes: clientesPendentes.length,
      };

      console.log("✅ Commission calculated:", result);
      return result;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
