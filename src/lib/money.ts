export const CURRENCIES = {
  PHP: { rate: 1, locale: "en-PH" },
  USD: { rate: 0.0172, locale: "en-US" },
  EUR: { rate: 0.0159, locale: "de-DE" },
  JPY: { rate: 2.62, locale: "ja-JP" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const BASE_CURRENCY: CurrencyCode = "PHP";

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats integer PHP centavos into the display currency. Charges always settle in PHP. */
export function formatMoney(centavos: number, currency: CurrencyCode = BASE_CURRENCY): string {
  const { rate, locale } = CURRENCIES[currency];
  const key = `${locale}:${currency}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "JPY" ? 0 : 2,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    });
    formatters.set(key, fmt);
  }
  return fmt.format((centavos / 100) * rate);
}

export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function formatDate(date: Date | number, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }, locale = "en-PH"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "Asia/Manila", ...opts }).format(date);
}
