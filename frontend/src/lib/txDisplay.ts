import { formatMoney, formatSigned } from "./money";

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сент", "окт", "нояб", "дек"];

export interface TxMember {
  userId: string;
  username: string;
}

export interface TxLike {
  type: "INCOME" | "EXPENSE";
  amount: { amount: number };
  category: { name: string };
  payer: { mode: "USER" | "SPLIT"; userId: string | null; shares: { userId: string; amount: { amount: number } }[] | null };
  date: string;
  comment: string | null;
}

function memberLabel(userId: string | null | undefined, members: TxMember[], currentUserId: string | undefined): string {
  if (!userId) return "—";
  if (userId === currentUserId) return "Вы";
  return members.find((m) => m.userId === userId)?.username ?? "Участник";
}

export function txTitle(t: TxLike): string {
  return t.comment || t.category.name;
}

export function txMeta(t: TxLike, members: TxMember[], currentUserId: string | undefined): string {
  const d = new Date(t.date);
  const when = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (t.payer.mode === "SPLIT" && t.payer.shares) {
    const amounts = t.payer.shares.map((s) => `${memberLabel(s.userId, members, currentUserId)} ${formatMoney(s.amount.amount)}`);
    const equal = new Set(t.payer.shares.map((s) => s.amount.amount)).size <= 1;
    return `${equal ? "Вместе поровну" : amounts.join(" · ")} · ${when}`;
  }
  return `${memberLabel(t.payer.userId, members, currentUserId)} · ${when}`;
}

export function txAmountLabel(t: TxLike): string {
  return formatSigned(t.amount.amount, t.type);
}

export function txAmountColor(t: TxLike): string {
  return t.type === "INCOME" ? "var(--forest-dark)" : "var(--rust)";
}
