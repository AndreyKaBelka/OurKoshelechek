import { formatMoney, formatSigned, type MoneyDirection } from "./money";

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сент", "окт", "нояб", "дек"];

export interface TxMember {
  userId: string;
  username: string;
}

export interface TxLike {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: { amount: number };
  category: { name: string; icon?: string | null } | null;
  payer: { mode: "USER" | "SPLIT"; userId: string | null; shares: { userId: string; amount: { amount: number } }[] | null };
  recipientUserId: string | null;
  date: string;
  comment: string | null;
}

function memberLabel(userId: string | null | undefined, members: TxMember[], currentUserId: string | undefined): string {
  if (!userId) return "—";
  if (userId === currentUserId) return "Вы";
  return members.find((m) => m.userId === userId)?.username ?? "Участник";
}

export function txTitle(t: TxLike): string {
  if (t.type === "TRANSFER") return t.comment || "Перевод";
  return t.comment || t.category?.name || (t.type === "INCOME" ? "Доход" : "Без категории");
}

export function txIcon(t: TxLike): string {
  if (t.type === "TRANSFER") return "🔁";
  return t.category?.icon || "💰";
}

/**
 * Transfers are an expense for the sender and an income for the recipient;
 * for any other member they're shown without a sign.
 */
export function txDirection(t: TxLike, currentUserId: string | undefined): MoneyDirection {
  if (t.type === "INCOME") return "in";
  if (t.type === "EXPENSE") return "out";
  if (currentUserId && t.payer.userId === currentUserId) return "out";
  if (currentUserId && t.recipientUserId === currentUserId) return "in";
  return "neutral";
}

export function txMeta(t: TxLike, members: TxMember[], currentUserId: string | undefined): string {
  const d = new Date(t.date);
  const when = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (t.type === "TRANSFER") {
    return `${memberLabel(t.payer.userId, members, currentUserId)} → ${memberLabel(t.recipientUserId, members, currentUserId)} · ${when}`;
  }
  if (t.payer.mode === "SPLIT" && t.payer.shares) {
    const amounts = t.payer.shares.map((s) => `${memberLabel(s.userId, members, currentUserId)} ${formatMoney(s.amount.amount)}`);
    const equal = new Set(t.payer.shares.map((s) => s.amount.amount)).size <= 1;
    return `${equal ? "Вместе поровну" : amounts.join(" · ")} · ${when}`;
  }
  return `${memberLabel(t.payer.userId, members, currentUserId)} · ${when}`;
}

export function txAmountLabel(t: TxLike, currentUserId: string | undefined): string {
  return formatSigned(t.amount.amount, txDirection(t, currentUserId));
}

export function txAmountColor(t: TxLike, currentUserId: string | undefined): string {
  const direction = txDirection(t, currentUserId);
  return direction === "in" ? "var(--forest-dark)" : direction === "out" ? "var(--rust)" : "var(--ink-soft)";
}
