/**
 * Date utility functions for consistent date formatting across the application.
 * Prevents timezone issues by using local date formatting instead of toISOString().
 */

/**
 * Formats a date as YYYY-MM-DD string using local timezone.
 * This prevents UTC conversion issues that occur with toISOString().
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets consistent datetime boundaries for a date range.
 * Returns start of day (00:00:00) and end of day (23:59:59) strings.
 */
export function getDateTimeBoundaries(startDate: Date, endDate: Date) {
  const startStr = formatLocalDate(startDate);
  const endStr = formatLocalDate(endDate);
  return {
    startDateTime: `${startStr}T00:00:00`,
    endDateTime: `${endStr}T23:59:59`,
    startStr,
    endStr
  };
}

/**
 * Gets datetime boundaries for a single date (same start and end).
 */
export function getSingleDateBoundaries(date: Date) {
  const dateStr = formatLocalDate(date);
  return {
    startDateTime: `${dateStr}T00:00:00`,
    endDateTime: `${dateStr}T23:59:59`,
    dateStr
  };
}

/**
 * Gets the start of day datetime string for a date.
 */
export function getStartOfDayString(date: Date): string {
  return `${formatLocalDate(date)}T00:00:00`;
}

/**
 * Gets the end of day datetime string for a date.
 */
export function getEndOfDayString(date: Date): string {
  return `${formatLocalDate(date)}T23:59:59`;
}
