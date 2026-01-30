/**
 * AI Configuration Cache Helper
 * 
 * Provides cached access to AI configuration settings to reduce database queries.
 * Cache TTL: 60 seconds (kill switch doesn't need to be instantaneous)
 */

interface AIConfigCache {
  value: {
    ai_global_enabled: boolean;
    ai_shadow_mode: boolean;
  };
  expiresAt: number;
}

let configCache: AIConfigCache | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export interface AIConfig {
  ai_global_enabled: boolean;  // Kill Switch (false = all AI disabled)
  ai_shadow_mode: boolean;     // Shadow Mode (true = suggestions only, no execution)
}

/**
 * Get AI configuration with caching
 * Fetches both ai_global_enabled and ai_shadow_mode in a single query
 * and caches the result for 60 seconds
 */
export async function getAIConfig(supabase: any): Promise<AIConfig> {
  const now = Date.now();
  
  // Return cached value if valid
  if (configCache && configCache.expiresAt > now) {
    return configCache.value;
  }
  
  // Fetch both configs in a single query
  const { data: configs } = await supabase
    .from('system_configurations')
    .select('key, value')
    .in('key', ['ai_global_enabled', 'ai_shadow_mode']);
  
  const result: AIConfig = {
    // Default to enabled if not found
    ai_global_enabled: configs?.find((c: any) => c.key === 'ai_global_enabled')?.value !== 'false',
    // Default to shadow mode active (safety first)
    ai_shadow_mode: configs?.find((c: any) => c.key === 'ai_shadow_mode')?.value === 'true',
  };
  
  // Update cache
  configCache = {
    value: result,
    expiresAt: now + CACHE_TTL_MS,
  };
  
  return result;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearAIConfigCache(): void {
  configCache = null;
}

/**
 * Standard response for when Kill Switch is active
 */
export function createKillSwitchResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ 
      status: 'disabled', 
      reason: 'kill_switch',
      ai_global_enabled: false 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Semantic status values for AI responses
 */
export const AI_STATUS = {
  APPLIED: 'applied',           // AI executed the action
  SUGGESTED_ONLY: 'suggested_only', // AI suggested but did not apply (Shadow Mode)
  DISABLED: 'disabled',         // Kill Switch active, AI disabled
  SKIPPED: 'skipped',          // Condition not met (e.g., low CSAT)
} as const;
