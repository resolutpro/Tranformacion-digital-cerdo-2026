import { format, parseISO, toZonedTime, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";
import { 
  startOfDay as startOfDayUTC, 
  endOfDay as endOfDayUTC, 
  subDays, 
  isToday as isTodayUTC,
  formatDistanceToNow as formatDistanceToNowUTC
} from "date-fns";

const TIMEZONE = "Europe/Madrid";

/**
 * Convert UTC date to Europe/Madrid timezone for display
 */
export function toMadridTime(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(date, TIMEZONE);
}

/**
 * Convert Europe/Madrid date to UTC for storage
 */
export function fromMadridTime(madridDate: Date): Date {
  return fromZonedTime(madridDate, TIMEZONE);
}

/**
 * Format date in Europe/Madrid timezone
 */
export function formatMadridTime(utcDate: Date | string, formatStr: string): string {
  const madridDate = toMadridTime(utcDate);
  return format(madridDate, formatStr, { locale: es });
}

/**
 * Get start of day in Europe/Madrid timezone, returned as UTC
 */
export function startOfDayMadrid(date?: Date): Date {
  const targetDate = date || new Date();
  const madridDate = toMadridTime(targetDate);
  const startOfDayMadrid = startOfDayUTC(madridDate);
  return fromMadridTime(startOfDayMadrid);
}

/**
 * Get end of day in Europe/Madrid timezone, returned as UTC
 */
export function endOfDayMadrid(date?: Date): Date {
  const targetDate = date || new Date();
  const madridDate = toMadridTime(targetDate);
  const endOfDayMadrid = endOfDayUTC(madridDate);
  return fromMadridTime(endOfDayMadrid);
}

/**
 * Check if date is today in Europe/Madrid timezone
 */
export function isTodayMadrid(utcDate: Date | string): boolean {
  const madridDate = toMadridTime(utcDate);
  const madridNow = toMadridTime(new Date());
  return isTodayUTC(madridDate) && 
         madridDate.getDate() === madridNow.getDate() &&
         madridDate.getMonth() === madridNow.getMonth() &&
         madridDate.getFullYear() === madridNow.getFullYear();
}

/**
 * Format distance to now in Madrid timezone
 */
export function formatDistanceToNowMadrid(utcDate: Date | string): string {
  const madridDate = toMadridTime(utcDate);
  return formatDistanceToNowUTC(madridDate, { addSuffix: true, locale: es });
}

/**
 * Get date ranges for common filters (today, 7 days, 30 days) in Madrid timezone
 */
export function getDateRanges() {
  const now = new Date();
  
  return {
    today: {
      start: startOfDayMadrid(now),
      end: endOfDayMadrid(now),
    },
    last7Days: {
      start: startOfDayMadrid(subDays(now, 6)), // Include today
      end: endOfDayMadrid(now),
    },
    last30Days: {
      start: startOfDayMadrid(subDays(now, 29)), // Include today
      end: endOfDayMadrid(now),
    }
  };
}

/**
 * Calculate duration between two dates in days
 */
export function calculateDurationInDays(startDate: Date | string, endDate?: Date | string): number {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = endDate ? 
    (typeof endDate === 'string' ? parseISO(endDate) : endDate) : 
    new Date();
  
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format duration in a human-readable way
 */
export function formatDuration(days: number): string {
  if (days < 1) {
    return "Menos de 1 día";
  } else if (days === 1) {
    return "1 día";
  } else if (days < 30) {
    return `${days} días`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return remainingDays > 0 ? `${months} meses y ${remainingDays} días` : `${months} meses`;
  } else {
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    if (remainingDays > 30) {
      const months = Math.floor(remainingDays / 30);
      return `${years} años y ${months} meses`;
    } else {
      return `${years} años`;
    }
  }
}
