/** All amounts in the domain layer are integer kopecks (Money.amount in the GraphQL schema). */

export function formatMoney(kopecks: number): string {
  const rubles = Math.round(kopecks / 100);
  return rubles.toLocaleString("ru-RU").replace(/ /g, " ");
}

export function formatSigned(kopecks: number, type: "INCOME" | "EXPENSE"): string {
  const sign = type === "INCOME" ? "+" : "−";
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
