import { isFeatureEnabled, FeatureFlag } from "@/config/features";

/**
 * Hook para verificar feature flags
 * 
 * @example
 * const isEnterpriseV2 = useFeatureFlag('INBOX_ENTERPRISE_V2');
 * 
 * if (isEnterpriseV2) {
 *   // Usar nova lógica
 * }
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  // Versão simples: retorna valor da config
  // Pode evoluir para usar React Query + remote config no futuro
  return isFeatureEnabled(flag);
}
