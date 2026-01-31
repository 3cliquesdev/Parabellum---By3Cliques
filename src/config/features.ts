// ========== FEATURE FLAGS ==========
// Controla rollout gradual de features enterprise
// 
// IMPORTANTE: Modificar estes valores afeta TODO o sistema.
// Testar em preview antes de publicar.

export const FEATURE_FLAGS = {
  /**
   * Inbox Enterprise V2: Idempotência + Realtime Resiliente + Media
   * 
   * Quando TRUE:
   * - Usa client_message_id para dedup (em vez de content-matching)
   * - Polling condicional baseado em isHealthy (não fixo 5s)
   * - UPDATE handling no Realtime para status delivered/read
   * - Upload direto no Storage (não via edge function)
   * 
   * Quando FALSE:
   * - Comportamento legacy mantido
   * - Polling fixo 5s
   * - Dedup por content-matching
   */
  INBOX_ENTERPRISE_V2: true, // ✅ Ativado para produção
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Verifica se uma feature flag está ativada
 * 
 * @example
 * if (isFeatureEnabled('INBOX_ENTERPRISE_V2')) {
 *   // Usar nova lógica de dedup
 * }
 */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  return FEATURE_FLAGS[flag] === true;
};
