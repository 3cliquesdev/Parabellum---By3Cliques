// _shared/business-hours.ts — Single source of truth for business hours logic
// Used by: process-chat-flow, distribute-pending-conversations, whatsapp-window-keeper, redistribute-after-hours

const DAY_NAMES_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAY_ABBREV_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface BusinessHoursResult {
  within_hours: boolean;
  schedule_summary: string;   // e.g. "Seg–Sex 08:00–17:00"
  next_open_text: string;     // e.g. "Segunda às 08:00"
  is_holiday: boolean;
  holiday_name: string | null;
  current_day: number;
  current_time: string;
}

interface DayConfig {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

/**
 * Get current date/time in America/Sao_Paulo timezone.
 */
function getSaoPauloNow(): { dayOfWeek: number; timeStr: string; dateStr: string; monthDay: string } {
  const now = new Date();
  // Use Intl to get São Paulo components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const hour = get('hour');
  const minute = get('minute');
  const timeStr = `${hour}:${minute}`;

  // Get day of week via a dedicated formatter
  const dowFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
  const dowStr = dowFormatter.format(now);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dowMap[dowStr] ?? now.getDay();

  const month = get('month');
  const day = get('day');
  const dateStr = `${get('year')}-${month}-${day}`;
  const monthDay = `${month}-${day}`;

  return { dayOfWeek, timeStr, dateStr, monthDay };
}

/**
 * Build a human-readable schedule summary from configs.
 * Groups consecutive days with same hours. E.g. "Seg–Sex 08:00–17:00, Sáb 09:00–13:00"
 */
function buildScheduleSummary(configs: DayConfig[]): string {
  const workDays = configs.filter(c => c.is_working_day).sort((a, b) => a.day_of_week - b.day_of_week);
  if (workDays.length === 0) return 'Sem horário configurado';

  const groups: { start: number; end: number; startTime: string; endTime: string }[] = [];

  for (const d of workDays) {
    const st = d.start_time.slice(0, 5);
    const et = d.end_time.slice(0, 5);
    const last = groups[groups.length - 1];
    if (last && last.end === d.day_of_week - 1 && last.startTime === st && last.endTime === et) {
      last.end = d.day_of_week;
    } else {
      groups.push({ start: d.day_of_week, end: d.day_of_week, startTime: st, endTime: et });
    }
  }

  return groups.map(g => {
    const dayRange = g.start === g.end
      ? DAY_ABBREV_PT[g.start]
      : `${DAY_ABBREV_PT[g.start]}–${DAY_ABBREV_PT[g.end]}`;
    return `${dayRange} ${g.startTime}–${g.endTime}`;
  }).join(', ');
}

/**
 * Find the next opening time from the given day/time.
 */
function findNextOpen(configs: DayConfig[], currentDay: number, currentTime: string): string {
  const sorted = configs.filter(c => c.is_working_day).sort((a, b) => a.day_of_week - b.day_of_week);
  if (sorted.length === 0) return 'Sem previsão';

  // Check if today still has time left
  const today = sorted.find(c => c.day_of_week === currentDay);
  if (today && currentTime < today.start_time.slice(0, 5)) {
    return `Hoje às ${today.start_time.slice(0, 5)}`;
  }

  // Find next working day
  for (let offset = 1; offset <= 7; offset++) {
    const targetDay = (currentDay + offset) % 7;
    const config = sorted.find(c => c.day_of_week === targetDay);
    if (config) {
      return `${DAY_NAMES_PT[targetDay]} às ${config.start_time.slice(0, 5)}`;
    }
  }

  return 'Sem previsão';
}

/**
 * Main function: check if we are within business hours.
 * Queries business_hours_config and business_holidays.
 */
export async function getBusinessHoursInfo(supabaseClient: any): Promise<BusinessHoursResult> {
  const { dayOfWeek, timeStr, dateStr, monthDay } = getSaoPauloNow();

  // Fetch all configs + holidays in parallel
  const [configRes, holidayRes] = await Promise.all([
    supabaseClient.from('business_hours_config').select('day_of_week, start_time, end_time, is_working_day').order('day_of_week'),
    supabaseClient.from('business_holidays').select('date, description, is_recurring'),
  ]);

  const configs: DayConfig[] = configRes.data || [];
  const holidays = holidayRes.data || [];

  // Check holidays
  let isHoliday = false;
  let holidayName: string | null = null;

  for (const h of holidays) {
    if (h.is_recurring) {
      // Recurring: match month-day only
      const hMonthDay = h.date.slice(5); // "MM-DD"
      if (hMonthDay === monthDay) {
        isHoliday = true;
        holidayName = h.description;
        break;
      }
    } else {
      if (h.date === dateStr) {
        isHoliday = true;
        holidayName = h.description;
        break;
      }
    }
  }

  const schedule_summary = buildScheduleSummary(configs);
  const next_open_text = findNextOpen(configs, dayOfWeek, timeStr);

  if (isHoliday) {
    return {
      within_hours: false,
      schedule_summary,
      next_open_text,
      is_holiday: true,
      holiday_name: holidayName,
      current_day: dayOfWeek,
      current_time: timeStr,
    };
  }

  // Check today's config
  const todayConfig = configs.find(c => c.day_of_week === dayOfWeek);
  if (!todayConfig || !todayConfig.is_working_day) {
    return {
      within_hours: false,
      schedule_summary,
      next_open_text,
      is_holiday: false,
      holiday_name: null,
      current_day: dayOfWeek,
      current_time: timeStr,
    };
  }

  const startTime = todayConfig.start_time.slice(0, 5);
  const endTime = todayConfig.end_time.slice(0, 5);
  const within_hours = timeStr >= startTime && timeStr < endTime;

  return {
    within_hours,
    schedule_summary,
    next_open_text: within_hours ? `Aberto agora até ${endTime}` : next_open_text,
    is_holiday: false,
    holiday_name: null,
    current_day: dayOfWeek,
    current_time: timeStr,
  };
}

/**
 * Simple boolean check — backward compatible with existing inline checks.
 */
export async function isWithinBusinessHours(supabaseClient: any): Promise<boolean> {
  const info = await getBusinessHoursInfo(supabaseClient);
  return info.within_hours;
}
