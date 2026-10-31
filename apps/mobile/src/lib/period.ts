import { PeriodSchema } from '@family-budget/types';

/** Month names, nominative ("январь") and genitive ("января"), lowercase. */
const MONTH_NAMES = [
  ['январь', 'января'],
  ['февраль', 'февраля'],
  ['март', 'марта'],
  ['апрель', 'апреля'],
  ['май', 'мая'],
  ['июнь', 'июня'],
  ['июль', 'июля'],
  ['август', 'августа'],
  ['сентябрь', 'сентября'],
  ['октябрь', 'октября'],
  ['ноябрь', 'ноября'],
  ['декабрь', 'декабря'],
] as const;

function parts(period: string): { year: number; month: number } {
  const [year = '0', month = '1'] = period.split('-');
  return { year: Number(year), month: Number(month) };
}

/** Months since year 0 — makes period arithmetic a plain integer subtraction. */
function ordinal(period: string): number {
  const { year, month } = parts(period);
  return year * 12 + (month - 1);
}

function monthName(period: string, form: 0 | 1): string {
  const { month } = parts(period);
  return MONTH_NAMES[month - 1]?.[form] ?? period;
}

/** Nominative lowercase, for the middle of a sentence ("по февраль 2026", "Открыть январь 2026"). */
export function formatPeriodLower(period: string): string {
  return `${monthName(period, 0)} ${parts(period).year}`;
}

/** Nominative, capitalised, for headings and sentence starts: "2026-01" -> "Январь 2026". Month-only (AC-21, ADR 0006). */
export function formatPeriodLabel(period: string): string {
  const lower = formatPeriodLower(period);
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Genitive lowercase: "2026-01" -> "января 2026" ("с января 2026", "черновик февраля 2026"). */
export function formatPeriodGenitive(period: string): string {
  return `${monthName(period, 1)} ${parts(period).year}`;
}

/** YYYY-MM with a real month number (01-12). */
export function isValidPeriod(value: string): boolean {
  if (!PeriodSchema.safeParse(value).success) return false;
  const { month } = parts(value);
  return month >= 1 && month <= 12;
}

/** The immediately following calendar period ("2026-12" -> "2027-01"). */
export function nextPeriod(period: string): string {
  const next = ordinal(period) + 1;
  return `${Math.floor(next / 12)}-${String((next % 12) + 1).padStart(2, '0')}`;
}

/** Today's period; only used to prefill the first-month form. */
export function todayPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Neighbouring existing period in `periods` (sorted ascending), or null at the edge. */
export function neighbourPeriod(periods: string[], current: string, direction: -1 | 1): string | null {
  const index = periods.indexOf(current);
  if (index < 0) return null;
  return periods[index + direction] ?? null;
}

/**
 * Existing period in the adjacent calendar year, closest to the same month of that year.
 * Null when no month exists in that year.
 */
export function adjacentYearPeriod(periods: string[], current: string, direction: -1 | 1): string | null {
  const { year, month } = parts(current);
  const targetYear = year + direction;
  const inYear = periods.filter((period) => parts(period).year === targetYear);
  if (inYear.length === 0) return null;
  const target = ordinal(`${targetYear}-${String(month).padStart(2, '0')}`);
  return inYear.reduce((best, period) =>
    Math.abs(ordinal(period) - target) < Math.abs(ordinal(best) - target) ? period : best,
  );
}
