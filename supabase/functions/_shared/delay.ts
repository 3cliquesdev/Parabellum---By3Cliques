/**
 * Shared delay utilities for playbook delay nodes
 * Used by both Edge Functions and frontend (via mirrored copy in src/lib/utils.ts)
 */

/**
 * Converts delay (type + value) to seconds
 * @param delayType - 'minutes' | 'hours' | 'days'
 * @param delayValue - positive integer value
 * @returns seconds (number)
 */
export function convertDelayToSeconds(delayType: string, delayValue: number): number {
  const value = Math.max(1, Math.floor(delayValue));
  
  switch (delayType?.toLowerCase()) {
    case 'minutes':
      return value * 60;
    case 'hours':
      return value * 3600;
    case 'days':
      return value * 86400;
    default:
      return 86400; // fallback: 1 day
  }
}

/**
 * Formats delay for UI display
 * @returns pluralized string (e.g., "Aguardar 5 minutos")
 */
export function formatDelayDisplay(delayType: string, delayValue: number): string {
  const type = delayType?.toLowerCase() || 'days';
  const value = Math.max(1, Math.floor(delayValue));
  
  switch (type) {
    case 'minutes':
      return `Aguardar ${value} ${value === 1 ? 'minuto' : 'minutos'}`;
    case 'hours':
      return `Aguardar ${value} ${value === 1 ? 'hora' : 'horas'}`;
    case 'days':
      return `Aguardar ${value} ${value === 1 ? 'dia' : 'dias'}`;
    default:
      return 'Aguardar';
  }
}

/**
 * Normalizes delay data with fallback for backward compatibility
 * - If no delay_type/delay_value and has duration_days -> converts
 * - Clamp: min=1, max=365 days (1 year)
 * - Always returns duration_days = (total_seconds / 86400) for compatibility
 */
export function normalizeDelayData(nodeData: any): {
  delay_type: 'minutes' | 'hours' | 'days';
  delay_value: number;
  duration_days: number;
} {
  // Priority: delay_type/value > duration_days > defaults
  let delayType = nodeData?.delay_type || 'days';
  let delayValue = nodeData?.delay_value ?? (nodeData?.duration_days || 1);
  
  // Validate type
  if (!['minutes', 'hours', 'days'].includes(delayType?.toLowerCase())) {
    delayType = 'days';
  }
  
  // Ensure value is positive
  delayValue = Math.max(1, Math.floor(delayValue));
  
  // Clamp value: max 365 days (1 year in seconds)
  const maxSeconds = 365 * 86400;
  const seconds = convertDelayToSeconds(delayType, delayValue);
  
  if (seconds > maxSeconds) {
    console.warn('[normalizeDelayData] Clamped delay to max (1 year)');
    delayValue = 365;
    delayType = 'days';
  }
  
  // Always calculate duration_days as float (for backward compatibility)
  const finalSeconds = convertDelayToSeconds(delayType, delayValue);
  const durationDays = finalSeconds / 86400;
  
  return {
    delay_type: delayType.toLowerCase() as 'minutes' | 'hours' | 'days',
    delay_value: delayValue,
    duration_days: durationDays,
  };
}
