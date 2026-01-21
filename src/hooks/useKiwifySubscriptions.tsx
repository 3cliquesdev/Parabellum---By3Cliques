/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠️ LÓGICA TRAVADA - VALIDADA EM 20/01/2026 ⚠️
 * 
 * Este hook é a FONTE ÚNICA DE VERDADE para métricas do Kiwify.
 * Usado pelo menu /subscriptions e dashboard /analytics.
 * 
 * NÃO ALTERAR esta lógica de contagem sem:
 * 1. Comparar resultados com o Kiwify
 * 2. Validar com dados do dia 15/01/2026
 * 3. Aprovar com o usuário antes de aplicar
 * ════════════════════════════════════════════════════════════════════════════
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductMappings, getMappedProductWithSourceType, categorizeProduct } from "@/lib/kiwifyProductMapping";

// Categoria dinâmica: usa o nome do produto mapeado diretamente
export type ProductCategory = string;
export type SubscriptionStatus = 'active' | 'canceled' | 'ended' | 'all';

export interface SubscriptionData {
  id: string;
  orderId: string;
  startDate: string;
  productName: string;
  productCategory: ProductCategory;
  offerName: string;
  customerName: string;
  customerEmail: string;
  status: 'active' | 'canceled' | 'ended';
  grossValue: number;
  netValue: number;
  kiwifyFee: number;
  affiliateCommission: number;
  sourceType: 'organico' | 'afiliado' | 'comercial'; // Canal de venda
}

export interface RefundData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  productName: string;
  productCategory: ProductCategory;
  offerName: string;
  refundDate: string;
  originalDate: string;
  value: number;
}

export interface SubscriptionMetrics {
  // Métricas de clientes únicos
  totalAssinaturas: number; // Clientes únicos (emails distintos)
  clientesNovos: number; // Primeira compra EVER no período
  clientesRecorrentes: number; // Já compraram antes do período
  
  // Métricas de vendas
  vendasBrutas: number; // Total de orders únicos
  vendasLiquidas: number; // Brutas - reembolsos
  reembolsos: RefundData[]; // Lista com data de cada reembolso
  
  // Classificação por tipo de venda (líquidas - já descontando reembolsos)
  novasAssinaturas: number; // charges.completed.length = 1
  renovacoes: number; // charges.completed.length > 1
  produtosUnicos: number; // Sem subscription plan (venda única)
  
  // Classificação por tipo de venda (brutas - antes de descontar reembolsos)
  novasAssinaturasBrutas: number;
  renovacoesBrutas: number;
  produtosUnicosBrutos: number;
  
  // Métricas legadas (mantidas para compatibilidade)
  totalAtivas: number;
  totalCanceladas: number;
  faturamentoRecorrente: number;
  subscriptions: SubscriptionData[];
  byCategory: Record<ProductCategory, { ativas: number; canceladas: number; faturamento: number }>;
}

// Categorize product based on name - using imported helper
// Function is now imported from kiwifyProductMapping.ts

// Parse subscription status from Kiwify event
function parseSubscriptionStatus(eventType: string, subscriptionStatus?: string): 'active' | 'canceled' | 'ended' {
  if (eventType === 'subscription_canceled' || subscriptionStatus === 'canceled') {
    return 'canceled';
  }
  if (subscriptionStatus === 'ended') {
    return 'ended';
  }
  return 'active';
}

// Format date for comparison (YYYY-MM-DD)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useKiwifySubscriptions(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['kiwify-subscriptions', startDate?.toISOString(), endDate?.toISOString()],
    staleTime: 60 * 1000, // Cache de 60 segundos
    refetchOnWindowFocus: false, // Evitar spam de requests
    retry: 3, // Retry em caso de falha de rede
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff exponencial
    placeholderData: (previousData) => previousData, // Manter dados anteriores durante falha
    queryFn: async (): Promise<SubscriptionMetrics> => {
      console.log('[useKiwifySubscriptions] Fetching subscription data...');
      
      // 1. Buscar mapeamentos usando helper centralizado
      const { offerMap: offerToProduct, productIdMap: productIdToProduct } = await fetchProductMappings();
      
      console.log(`[useKiwifySubscriptions] Loaded ${offerToProduct.size} offer mappings + ${productIdToProduct.size} product_id mappings`);
      
      // Fetch paid events
      let paidQuery = supabase
        .from('kiwify_events')
        .select('*')
        .eq('event_type', 'paid')
        .order('created_at', { ascending: false });

      // Apply date filters with margin for approved_date filtering
      if (startDate) {
        const marginStart = new Date(startDate);
        marginStart.setDate(marginStart.getDate() - 7);
        paidQuery = paidQuery.gte('created_at', marginStart.toISOString());
      }
      if (endDate) {
        const marginEnd = new Date(endDate);
        marginEnd.setDate(marginEnd.getDate() + 7);
        paidQuery = paidQuery.lte('created_at', marginEnd.toISOString());
      }

      // Paginate to get all paid events
      const allPaidEvents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore && page < 50) {
        const { data, error } = await paidQuery.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('[useKiwifySubscriptions] Error fetching paid events:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allPaidEvents.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`[useKiwifySubscriptions] Total paid events fetched: ${allPaidEvents.length}`);

      // Filter by approved_date within the selected period
      const startDateStr = startDate ? formatLocalDate(startDate) : null;
      const endDateStr = endDate ? formatLocalDate(endDate) : null;

      const filteredPaidEvents = allPaidEvents.filter(event => {
        const payload = event.payload as any;
        const approvedDate = payload?.approved_date;
        if (!approvedDate) return false;
        
        const approvedDateStr = approvedDate.substring(0, 10);
        
        if (startDateStr && approvedDateStr < startDateStr) return false;
        if (endDateStr && approvedDateStr > endDateStr) return false;
        
        return true;
      });

      console.log(`[useKiwifySubscriptions] Filtered paid events by approved_date: ${filteredPaidEvents.length}`);

      // Dedupe by order_id (keep first occurrence)
      const uniqueOrdersMap = new Map<string, any>();
      for (const event of filteredPaidEvents) {
        const payload = event.payload as any;
        const orderId = payload?.order_id || payload?.OrderId;
        if (orderId && !uniqueOrdersMap.has(orderId)) {
          uniqueOrdersMap.set(orderId, event);
        }
      }

      const uniqueOrders = Array.from(uniqueOrdersMap.values());
      console.log(`[useKiwifySubscriptions] Unique orders: ${uniqueOrders.length}`);
      
      // Helper function para obter produto MAPEADO { name, category, sourceType }
      // Usando helper centralizado de src/lib/kiwifyProductMapping.ts
      const getMappedProduct = (payload: any): { name: string; category: string; sourceType: 'organico' | 'afiliado' | 'comercial' } => {
        return getMappedProductWithSourceType(payload, offerToProduct, productIdToProduct);
      };

      // Classificar vendas por tipo: Nova Assinatura, Renovação ou Produto Único
      const novasAssinaturasOrders = new Set<string>();
      const renovacoesOrders = new Set<string>();
      const produtosUnicosOrders = new Set<string>();

      for (const event of uniqueOrders) {
        const payload = event.payload as any;
        const orderId = payload?.order_id || payload?.OrderId;
        if (!orderId) continue;

        const chargesCompleted = payload?.Subscription?.charges?.completed || [];
        const hasPlan = !!payload?.Subscription?.plan?.id;

        if (!hasPlan) {
          // Produto único (sem subscription plan)
          produtosUnicosOrders.add(orderId);
        } else if (chargesCompleted.length === 1) {
          // Nova assinatura (primeira cobrança)
          novasAssinaturasOrders.add(orderId);
        } else {
          // Renovação (cobranças recorrentes)
          renovacoesOrders.add(orderId);
        }
      }

      console.log(`[useKiwifySubscriptions] Classification - New: ${novasAssinaturasOrders.size}, Renewal: ${renovacoesOrders.size}, Unique: ${produtosUnicosOrders.size}`);

      // Calculate unique customers (unique emails)
      const uniqueCustomerEmails = new Set<string>();
      const emailToFirstOrderDate = new Map<string, string>(); // Track first order date in period
      
      for (const event of uniqueOrders) {
        const payload = event.payload as any;
        const email = payload?.Customer?.email || payload?.customer_email;
        if (email) {
          const emailLower = email.toLowerCase();
          uniqueCustomerEmails.add(emailLower);
          
          const approvedDate = payload?.approved_date?.substring(0, 10) || '';
          if (!emailToFirstOrderDate.has(emailLower) || approvedDate < emailToFirstOrderDate.get(emailLower)!) {
            emailToFirstOrderDate.set(emailLower, approvedDate);
          }
        }
      }

      console.log(`[useKiwifySubscriptions] Unique customers: ${uniqueCustomerEmails.size}`);

      // Determine new vs recurring customers
      // Fetch historical paid events BEFORE start date to check who is recurring
      let clientesNovos = 0;
      let clientesRecorrentes = 0;

      if (startDate && uniqueCustomerEmails.size > 0) {
        // Get all historical orders before the period to identify recurring customers
        const { data: historicalEvents } = await supabase
          .from('kiwify_events')
          .select('payload')
          .eq('event_type', 'paid')
          .lt('created_at', startDate.toISOString());

        const historicalCustomers = new Set<string>();
        for (const event of historicalEvents || []) {
          const payload = event.payload as any;
          const email = payload?.Customer?.email || payload?.customer_email;
          if (email) {
            historicalCustomers.add(email.toLowerCase());
          }
        }

        // Classify each customer
        for (const email of uniqueCustomerEmails) {
          if (historicalCustomers.has(email)) {
            clientesRecorrentes++;
          } else {
            clientesNovos++;
          }
        }
      } else {
        // If no start date, all are considered "new" for this view
        clientesNovos = uniqueCustomerEmails.size;
      }

      console.log(`[useKiwifySubscriptions] New customers: ${clientesNovos}, Recurring: ${clientesRecorrentes}`);

      // Fetch refund events for orders in the period
      const orderIds = Array.from(uniqueOrdersMap.keys());
      const refunds: RefundData[] = [];

      if (orderIds.length > 0) {
        // Fetch refunded events
        const { data: refundEvents, error: refundError } = await supabase
          .from('kiwify_events')
          .select('*')
          .eq('event_type', 'refunded');

        if (!refundError && refundEvents) {
          for (const refund of refundEvents) {
            const payload = refund.payload as any;
            const refundOrderId = payload?.order_id || payload?.OrderId;
            
            // Check if this refund is for an order in our period
            if (refundOrderId && uniqueOrdersMap.has(refundOrderId)) {
              const originalEvent = uniqueOrdersMap.get(refundOrderId);
              const originalPayload = originalEvent?.payload as any;
              
              // Extrair valor do objeto Commissions (estrutura real do Kiwify)
              const refundCommissions = payload?.Commissions || {};
              const refundValue = (refundCommissions.product_base_price || payload?.product_base_price || payload?.Product?.price || 0) / 100;
              
              const refundProduct = getMappedProduct(payload);
              refunds.push({
                orderId: refundOrderId,
                customerEmail: payload?.Customer?.email || payload?.customer_email || '',
                customerName: payload?.Customer?.full_name || payload?.customer_name || 'Cliente',
                productName: refundProduct.name,
                productCategory: refundProduct.category,
                offerName: payload?.Subscription?.plan?.name || payload?.Product?.product_offer_name || payload?.offer_name || 'Oferta padrão',
                refundDate: refund.created_at,
                originalDate: originalPayload?.approved_date || originalEvent?.created_at || '',
                value: refundValue,
              });
            }
          }
        }
      }

      console.log(`[useKiwifySubscriptions] Refunds found: ${refunds.length}`);

      // Calcular vendas líquidas por tipo (descontando reembolsos de cada categoria)
      const refundedOrderIds = new Set(refunds.map(r => r.orderId));
      
      const novasAssinaturasLiquidas = [...novasAssinaturasOrders].filter(id => !refundedOrderIds.has(id)).length;
      const renovacoesLiquidas = [...renovacoesOrders].filter(id => !refundedOrderIds.has(id)).length;
      const produtosUnicosLiquidos = [...produtosUnicosOrders].filter(id => !refundedOrderIds.has(id)).length;

      console.log(`[useKiwifySubscriptions] Liquid sales - New: ${novasAssinaturasLiquidas}, Renewal: ${renovacoesLiquidas}, Unique: ${produtosUnicosLiquidos}`);

      // Process subscriptions for the table and category breakdown
      const subscriptionMap = new Map<string, SubscriptionData>();
      const processedOrderIds = new Set<string>();

      // Fetch subscription status events
      let statusQuery = supabase
        .from('kiwify_events')
        .select('*')
        .in('event_type', ['subscription_canceled', 'subscription_ended'])
        .order('created_at', { ascending: false });

      const { data: statusEvents } = await statusQuery;
      const statusByOrderId = new Map<string, string>();
      
      for (const event of statusEvents || []) {
        const payload = event.payload as any;
        const orderId = payload?.order_id || payload?.OrderId;
        const subscriptionId = payload?.Subscription?.id || payload?.subscription_id;
        const key = subscriptionId || orderId;
        
        if (key && !statusByOrderId.has(key)) {
          statusByOrderId.set(key, event.event_type);
        }
      }

      for (const event of uniqueOrders) {
        const payload = event.payload as any;
        if (!payload) continue;

        const orderId = payload.order_id || payload.OrderId;
        const subscriptionId = payload.Subscription?.id || payload.subscription_id;
        const uniqueKey = subscriptionId || orderId;
        
        if (!uniqueKey) continue;
        if (processedOrderIds.has(uniqueKey)) continue;
        processedOrderIds.add(uniqueKey);

        // Usar produto MAPEADO (da tabela product_offers) - nome E categoria
        const mappedProduct = getMappedProduct(payload);
        
        // Extrair valores financeiros do objeto Commissions (estrutura real do Kiwify)
        const commissions = payload.Commissions || {};
        const grossValue = (commissions.product_base_price || payload.product_base_price || payload.Product?.price || 0) / 100;
        const myCommission = (commissions.my_commission || payload.my_commission || 0) / 100;
        const kiwifyFee = (commissions.kiwify_fee || payload.kiwify_fee || 0) / 100;
        
        // Calcular comissão de afiliados (soma dos valores de tipo 'affiliate' no commissioned_stores)
        const affiliateCommission = (commissions.commissioned_stores || [])
          .filter((store: any) => store.type === 'affiliate')
          .reduce((sum: number, store: any) => sum + (store.value || 0), 0) / 100;
        
        // Determine status
        let status: 'active' | 'canceled' | 'ended' = 'active';
        const statusEvent = statusByOrderId.get(uniqueKey);
        if (statusEvent === 'subscription_canceled') {
          status = 'canceled';
        } else if (statusEvent === 'subscription_ended') {
          status = 'ended';
        }

        // Check if refunded
        const isRefunded = refunds.some(r => r.orderId === orderId);
        if (isRefunded) {
          status = 'canceled';
        }
        
        const subscription: SubscriptionData = {
          id: uniqueKey,
          orderId: orderId || '',
          startDate: payload.approved_date || payload.created_at || event.created_at,
          productName: mappedProduct.name,
          productCategory: mappedProduct.category, // Usa categoria do mapeamento, não inferência
          offerName: payload.Subscription?.plan?.name || payload.offer_name || 'Oferta padrão',
          customerName: payload.Customer?.full_name || payload.customer_name || 'Cliente',
          customerEmail: payload.Customer?.email || payload.customer_email || '',
          status,
          grossValue,
          netValue: myCommission,
          kiwifyFee,
          affiliateCommission,
          sourceType: mappedProduct.sourceType, // Canal de venda (afiliado/organico/comercial)
        };

        subscriptionMap.set(uniqueKey, subscription);
      }

      // Convert to array and calculate metrics
      const subscriptions = Array.from(subscriptionMap.values());
      
      // Initialize category metrics - agora dinâmico baseado nos produtos mapeados
      const byCategory: Record<string, { ativas: number; canceladas: number; faturamento: number }> = {};
      
      // Pré-popular com categorias conhecidas para manter compatibilidade
      const legacyCategories = ['Associado Premium', 'Shopee Creation', 'Híbrido', 'Uni 3 Cliques', 'Outros'];
      for (const cat of legacyCategories) {
        byCategory[cat] = { ativas: 0, canceladas: 0, faturamento: 0 };
      }

      let totalAtivas = 0;
      let totalCanceladas = 0;
      let faturamentoRecorrente = 0;

      for (const sub of subscriptions) {
        // Criar entrada para categoria se não existir (categorias dinâmicas dos mapeamentos)
        if (!byCategory[sub.productCategory]) {
          byCategory[sub.productCategory] = { ativas: 0, canceladas: 0, faturamento: 0 };
        }
        
        const catMetrics = byCategory[sub.productCategory];
        
        if (sub.status === 'active') {
          totalAtivas++;
          catMetrics.ativas++;
          faturamentoRecorrente += sub.netValue;
          catMetrics.faturamento += sub.netValue;
        } else {
          totalCanceladas++;
          catMetrics.canceladas++;
        }
      }

      const result: SubscriptionMetrics = {
        // Novas métricas
        totalAssinaturas: uniqueCustomerEmails.size,
        clientesNovos,
        clientesRecorrentes,
        vendasBrutas: uniqueOrders.length,
        vendasLiquidas: uniqueOrders.length - refunds.length,
        reembolsos: refunds,
        
        // Classificação por tipo (líquidas)
        novasAssinaturas: novasAssinaturasLiquidas,
        renovacoes: renovacoesLiquidas,
        produtosUnicos: produtosUnicosLiquidos,
        
        // Classificação por tipo (brutas - para tooltips explicativos)
        novasAssinaturasBrutas: novasAssinaturasOrders.size,
        renovacoesBrutas: renovacoesOrders.size,
        produtosUnicosBrutos: produtosUnicosOrders.size,
        
        // Métricas legadas
        totalAtivas,
        totalCanceladas,
        faturamentoRecorrente,
        subscriptions,
        byCategory,
      };

      console.log(`[useKiwifySubscriptions] Final metrics:`, {
        totalAssinaturas: result.totalAssinaturas,
        clientesNovos: result.clientesNovos,
        clientesRecorrentes: result.clientesRecorrentes,
        vendasBrutas: result.vendasBrutas,
        vendasLiquidas: result.vendasLiquidas,
        novasAssinaturas: result.novasAssinaturas,
        renovacoes: result.renovacoes,
        produtosUnicos: result.produtosUnicos,
        reembolsos: result.reembolsos.length,
      });

      return result;
    },
  });
}
