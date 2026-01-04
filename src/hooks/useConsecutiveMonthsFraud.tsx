import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ConsecutiveFraudCustomer {
  customer_email: string;
  customer_name: string;
  customer_cpf: string;
  offer_id: string;
  offer_name: string;
  consecutive_months: string[]; // ['2025-12', '2026-01']
  total_consecutive: number;
  total_value: number;
  purchase_details: { month: string; date: string; value: number }[];
}

export interface ConsecutiveFraudStats {
  totalFraudulentCustomers: number;
  totalConsecutiveMonths: number;
  estimatedLostValue: number;
  avgConsecutiveMonths: number;
}

export interface ConsecutiveFraudFilters {
  offerId?: string;
  maxValue?: number;
  startDate?: Date;
  endDate?: Date;
  minConsecutiveMonths?: number;
}

// Detecta sequências de meses consecutivos
function detectConsecutiveMonths(months: string[]): string[][] {
  if (months.length < 2) return [];
  
  // Ordenar meses cronologicamente
  const sorted = [...new Set(months)].sort();
  const sequences: string[][] = [];
  let currentSeq: string[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const [prevYear, prevMonth] = sorted[i - 1].split('-').map(Number);
    const [currYear, currMonth] = sorted[i].split('-').map(Number);
    
    // Calcular o próximo mês esperado
    const expectedMonth = prevMonth === 12 ? 1 : prevMonth + 1;
    const expectedYear = prevMonth === 12 ? prevYear + 1 : prevYear;
    
    if (currYear === expectedYear && currMonth === expectedMonth) {
      currentSeq.push(sorted[i]);
    } else {
      if (currentSeq.length >= 2) sequences.push([...currentSeq]);
      currentSeq = [sorted[i]];
    }
  }
  
  if (currentSeq.length >= 2) sequences.push(currentSeq);
  return sequences;
}

// Formata mês para exibição (2025-12 -> Dez/25)
export function formatMonthDisplay(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;
}

export function useConsecutiveMonthsFraud(filters: ConsecutiveFraudFilters = {}) {
  const { minConsecutiveMonths = 2, maxValue = 10, offerId, startDate, endDate } = filters;

  return useQuery({
    queryKey: ['consecutive-months-fraud', filters],
    queryFn: async () => {
      // Buscar eventos de pagamento
      let query = supabase
        .from('kiwify_events')
        .select('payload, offer_id, created_at, order_id')
        .in('event_type', ['paid', 'order_approved'])
        .order('created_at', { ascending: false })
        .limit(10000);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: events, error } = await query;

      if (error) throw error;

      // Agrupar TODAS as compras por customer (para detectar upgrades)
      const customerPurchasesMap = new Map<string, {
        customer_email: string;
        customer_name: string;
        customer_cpf: string;
        purchases: { 
          month: string; 
          date: string; 
          value: number; 
          order_id: string;
          offer_id: string;
          offer_name: string;
        }[];
      }>();

      for (const event of events || []) {
        const payload = event.payload as any;
        const customerEmail = payload?.Customer?.email?.toLowerCase();
        const customerName = payload?.Customer?.full_name || 'N/A';
        const customerCpf = payload?.Customer?.CPF || 'N/A';
        const subscriptionOfferId = payload?.Subscription?.plan?.id;
        const subscriptionOfferName = payload?.Subscription?.plan?.name;
        const productId = payload?.Product?.product_id;
        const productName = payload?.Product?.product_name || 'N/A';
        const grossValue = (payload?.Commissions?.product_base_price || 0) / 100;
        const orderId = event.order_id || payload?.order_id;

        // Determinar offer_id
        const currentOfferId = subscriptionOfferId || event.offer_id || productId;
        const currentOfferName = subscriptionOfferName || productName;

        if (!customerEmail || !currentOfferId) continue;

        // Filtro por offer específica (se fornecido)
        if (offerId && currentOfferId !== offerId) continue;

        const eventDate = new Date(event.created_at);
        const purchaseMonth = format(eventDate, 'yyyy-MM');
        const purchaseDate = format(eventDate, 'dd/MM/yyyy');

        const existing = customerPurchasesMap.get(customerEmail);

        if (existing) {
          // Verificar se já existe essa order_id (deduplicar)
          if (!existing.purchases.some(p => p.order_id === orderId)) {
            existing.purchases.push({
              month: purchaseMonth,
              date: purchaseDate,
              value: grossValue,
              order_id: orderId,
              offer_id: currentOfferId,
              offer_name: currentOfferName
            });
          }
        } else {
          customerPurchasesMap.set(customerEmail, {
            customer_email: customerEmail,
            customer_name: customerName,
            customer_cpf: customerCpf,
            purchases: [{
              month: purchaseMonth,
              date: purchaseDate,
              value: grossValue,
              order_id: orderId,
              offer_id: currentOfferId,
              offer_name: currentOfferName
            }]
          });
        }
      }

      // Filtrar clientes com meses consecutivos de BAIXO VALOR (sem upgrade)
      const fraudulentCustomers: ConsecutiveFraudCustomer[] = [];
      let totalConsecutiveMonths = 0;
      let estimatedLostValue = 0;

      for (const [_, data] of customerPurchasesMap) {
        // Separar compras de baixo valor e alto valor
        const lowValuePurchases = data.purchases.filter(p => p.value <= maxValue);
        const highValuePurchases = data.purchases.filter(p => p.value > maxValue);

        // Se não tem compras de baixo valor suficientes, pular
        if (lowValuePurchases.length < minConsecutiveMonths) continue;

        // Verificar se cliente fez UPGRADE (compra de alto valor)
        if (highValuePurchases.length > 0) {
          // Encontrar a primeira compra de baixo valor
          const sortedLowValue = lowValuePurchases.sort((a, b) => a.month.localeCompare(b.month));
          const firstLowValueMonth = sortedLowValue[0].month;

          // Verificar se há upgrade APÓS a primeira compra de baixo valor
          const hasUpgradeAfter = highValuePurchases.some(p => p.month >= firstLowValueMonth);

          if (hasUpgradeAfter) {
            // Cliente fez upgrade legítimo, não é fraude
            continue;
          }
        }

        // Agrupar compras de baixo valor por offer_id
        const offerGroups = new Map<string, typeof lowValuePurchases>();
        for (const purchase of lowValuePurchases) {
          const existing = offerGroups.get(purchase.offer_id) || [];
          existing.push(purchase);
          offerGroups.set(purchase.offer_id, existing);
        }

        // Verificar cada oferta separadamente
        for (const [currentOfferId, purchases] of offerGroups) {
          const months = purchases.map(p => p.month);
          const consecutiveSequences = detectConsecutiveMonths(months);

          // Pegar a maior sequência consecutiva
          const longestSequence = consecutiveSequences.reduce(
            (longest, current) => current.length > longest.length ? current : longest,
            [] as string[]
          );

          if (longestSequence.length >= minConsecutiveMonths) {
            // Filtrar purchases que estão na sequência consecutiva
            const relevantPurchases = purchases.filter(p => 
              longestSequence.includes(p.month)
            );

            // Valor perdido = valor das compras após a primeira (que seria legítima)
            const sortedPurchases = relevantPurchases.sort((a, b) => 
              a.month.localeCompare(b.month)
            );
            const lostValue = sortedPurchases.slice(1).reduce((sum, p) => sum + p.value, 0);

            totalConsecutiveMonths += longestSequence.length;
            estimatedLostValue += lostValue;

            fraudulentCustomers.push({
              customer_email: data.customer_email,
              customer_name: data.customer_name,
              customer_cpf: data.customer_cpf,
              offer_id: currentOfferId,
              offer_name: purchases[0].offer_name,
              consecutive_months: longestSequence,
              total_consecutive: longestSequence.length,
              total_value: relevantPurchases.reduce((sum, p) => sum + p.value, 0),
              purchase_details: sortedPurchases.map(p => ({
                month: p.month,
                date: p.date,
                value: p.value
              }))
            });
          }
        }
      }

      // Ordenar por quantidade de meses consecutivos (mais grave primeiro)
      fraudulentCustomers.sort((a, b) => b.total_consecutive - a.total_consecutive);

      const stats: ConsecutiveFraudStats = {
        totalFraudulentCustomers: fraudulentCustomers.length,
        totalConsecutiveMonths,
        estimatedLostValue,
        avgConsecutiveMonths: fraudulentCustomers.length > 0
          ? Math.round((totalConsecutiveMonths / fraudulentCustomers.length) * 10) / 10
          : 0
      };

      return {
        customers: fraudulentCustomers,
        stats
      };
    },
    staleTime: 60 * 1000, // 1 minuto
  });
}
