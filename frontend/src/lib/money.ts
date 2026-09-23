/** All amounts in the domain layer are integer kopecks (Money.amount in the GraphQL schema). */

export function formatMoney(kopecks: number): string {
  const rubles = Math.round(kopecks / 100);
  return rubles.toLocaleString("ru-RU").replace(/ /g, " ");
}

/** Direction of money for the viewer: "in" (+), "out" (−) or "neutral" (no sign, e.g. someone else's transfer). */
export type MoneyDirection = "in" | "out" | "neutral";

export function formatSigned(kopecks: number, direction: MoneyDirection): string {
  const sign = direction === "in" ? "+" : direction === "out" ? "−" : "";
  return `${sign}${formatMoney(Math.abs(kopecks))} ₽`;
}

/** Parses a free-typed rouble string (digits/spaces) from an input into kopecks. */
export function parseRoubleInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) * 100;
}

export function roublesToKopecks(roubles: number): number {
  return Math.round(roubles * 100);
}

export function kopecksToRoubleInput(kopecks: number): string {
  return kopecks ? String(Math.round(kopecks / 100)) : "";
}

/** Formats a digits-only rouble string with thousand separators: "3000" → "3 000". */
export function formatRoubleInput(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
