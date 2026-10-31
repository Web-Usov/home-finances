const NBSP = '\u00A0';

interface FormatRublesOptions {
  /** Keep a minus sign and prefix positive non-zero values with "+" (net adjustments only). */
  signed?: boolean;
}

/**
 * Format an API decimal string ("15000.5", "-120.00") for display in ru-RU: thousands separated by a
 * no-break space, comma as the decimal separator, always two fractional digits, then "₽".
 * Works on the string itself — no float arithmetic (FIN-08). Unless `signed`, a negative value is shown as
 * zero because negative balances are never displayed (NFR-24).
 */
export function formatRubles(value: string, { signed = false }: FormatRublesOptions = {}): string {
  const negative = value.startsWith('-');
  const [integerPart = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const body = `${grouped},${fraction.padEnd(2, '0').slice(0, 2)}`;
  const isZero = !/[1-9]/.test(body);
  if (isZero) return `${body}${NBSP}₽`;
  if (!signed) return negative ? `0,00${NBSP}₽` : `${body}${NBSP}₽`;
  return `${negative ? '−' : '+'}${body}${NBSP}₽`;
}

/** True when the decimal string holds a non-zero amount. */
export function isNonZeroMoney(value: string): boolean {
  return /[1-9]/.test(value);
}

/** Normalise user input ("1 500,5") to an API decimal string ("1500.5"); validation stays with `MoneyStringSchema`. */
export function normalizeMoneyInput(raw: string): string {
  return raw.replace(/\s/g, '').replace(',', '.');
}
