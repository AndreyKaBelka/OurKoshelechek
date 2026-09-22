import { useState } from "react";
import { useAppStore, authErrorMessage } from "../store/store";
import { formatMoney, kopecksToRoubleInput, roublesToKopecks } from "../lib/money";
import { categoryIcon, TwoPathIcon } from "../lib/icons";
import { txAmountColor, txAmountLabel, txMeta, txTitle } from "../lib/txDisplay";
import { useCategoriesQuery } from "../graphql/operations/categories.generated";
import { useCreateTransactionMutation, useTransactionsQuery } from "../graphql/operations/transactions.generated";
import type { PayerInput, TransactionType } from "../graphql/types";

type PayerChoice = "you" | "partner" | "split";
type Filter = "all" | "INCOME" | "EXPENSE";

const categoriesContext = { additionalTypenames: ["Category"] };
const transactionsContext = { additionalTypenames: ["Transaction", "GoalContribution"] };

export function TransactionsScreen() {
  const { currentUser, activeGroup } = useAppStore();
  const currentUserId = currentUser?.id;
  const groupId = activeGroup?.id ?? "";
  const partner = activeGroup?.members.find((m) => !m.self);

  const [categoriesResult] = useCategoriesQuery({ variables: { groupId }, pause: !groupId, context: categoriesContext });
  const categories = categoriesResult.data?.categories ?? [];

  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payerChoice, setPayerChoice] = useState<PayerChoice>("split");
  const [shareYou, setShareYou] = useState("");
  const [sharePartner, setSharePartner] = useState("");
  const [sharesAuto, setSharesAuto] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);

  const [transactionsResult] = useTransactionsQuery({
    variables: { groupId, filter: filter === "all" ? undefined : { type: filter }, first: 50 },
    pause: !groupId,
    context: transactionsContext,
  });
  const [, createTransaction] = useCreateTransactionMutation();

  const total = roublesToKopecks(parseInt(amount.replace(/\D/g, ""), 10) || 0);
  const shareYouK = roublesToKopecks(parseInt(shareYou.replace(/\D/g, ""), 10) || 0);
  const sharePartnerK = roublesToKopecks(parseInt(sharePartner.replace(/\D/g, ""), 10) || 0);
  const sharesSum = shareYouK + sharePartnerK;
  const isSplit = payerChoice === "split";
  const isIncome = type === "INCOME";
  const formValid = !!total && (isIncome || !!categoryId) && (!isSplit || sharesSum === total);

  if (!activeGroup) return null;

  function applyEvenSplit(totalK: number) {
    const half = Math.floor(totalK / 2);
    setShareYou(totalK ? kopecksToRoubleInput(totalK - half) : "");
    setSharePartner(totalK ? kopecksToRoubleInput(half) : "");
  }

  function onAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setAmount(digits);
    if (isSplit && sharesAuto) applyEvenSplit(roublesToKopecks(parseInt(digits, 10) || 0));
  }

  async function submit() {
    if (!formValid || !currentUserId || !activeGroup) return;
    let payer: PayerInput;
    if (payerChoice === "you") payer = { mode: "USER", userId: currentUserId, shares: null };
    else if (payerChoice === "partner") payer = { mode: "USER", userId: partner?.userId ?? currentUserId, shares: null };
    else
      payer = {
        mode: "SPLIT",
        userId: null,
        shares: [
          { userId: currentUserId, amount: { amount: shareYouK } },
          { userId: partner?.userId ?? currentUserId, amount: { amount: sharePartnerK } },
        ],
      };

    const result = await createTransaction({
      groupId: activeGroup.id,
      input: { type, amount: { amount: total }, categoryId: isIncome ? null : categoryId, payer, date: `${date}T00:00:00Z`, comment: comment.trim() || null },
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setError("");
    setAmount("");
    setComment("");
    setShareYou("");
    setSharePartner("");
    setSharesAuto(true);
    setSubmitted(true);
  }

  const items = transactionsResult.data?.transactions.items ?? [];
  const members = activeGroup.members.map((m) => ({ userId: m.userId, username: m.username }));

  const splitHint = !total
    ? "Сначала укажите сумму операции"
    : sharesSum === total
      ? `Доли сходятся: ${formatMoney(sharesSum)} из ${formatMoney(total)} ₽`
      : sharesSum < total
        ? `Доли: ${formatMoney(sharesSum)} из ${formatMoney(total)} ₽ — не хватает ${formatMoney(total - sharesSum)} ₽`
        : `Доли: ${formatMoney(sharesSum)} из ${formatMoney(total)} ₽ — лишние ${formatMoney(sharesSum - total)} ₽`;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="serif">Операции</h1>
        <p>Добавляйте и просматривайте операции</p>
      </div>

      <div className="card">
        <div className="segmented" style={{ marginBottom: 16 }}>
          <button type="button" className={type === "EXPENSE" ? "active" : ""} style={type === "EXPENSE" ? { background: "var(--rust)", color: "#fff" } : undefined} onClick={() => setType("EXPENSE")}>Расход</button>
          <button type="button" className={type === "INCOME" ? "active" : ""} style={type === "INCOME" ? { background: "var(--forest)", color: "#fff" } : undefined} onClick={() => setType("INCOME")}>Доход</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Сумма</label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 14px" }}>
            <input type="text" inputMode="numeric" placeholder="0" className="serif" value={amount} onChange={(e) => onAmountChange(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontSize: 24, fontWeight: 600, background: "none", minWidth: 0 }} />
            <span className="serif" style={{ fontSize: 18, color: "var(--ink-faint)" }}>₽</span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Комментарий</label>
          <input type="text" className="field" placeholder="Например, продукты во ВкусВилле" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        {!isIncome && (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Категория</label>
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">Сначала добавьте категорию в бюджете</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Кто платил</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={`choice-btn${payerChoice === "you" ? " active-forest" : ""}`} onClick={() => setPayerChoice("you")}>Вы</button>
            <button type="button" className={`choice-btn${payerChoice === "partner" ? " active-partner" : ""}`} onClick={() => setPayerChoice("partner")}>{partner?.username ?? "Партнёр"}</button>
            <button
              type="button"
              className={`choice-btn${payerChoice === "split" ? " active-forest" : ""}`}
              onClick={() => {
                setPayerChoice("split");
                setSharesAuto(true);
                applyEvenSplit(total);
              }}
            >
              Вместе
            </button>
          </div>

          {isSplit && (
            <div style={{ marginTop: 12, padding: 14, background: "var(--ivory)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--ink-soft)" }}>Кто сколько вложил</span>
                <button type="button" className="link-btn" style={{ color: "var(--forest-dark)" }} onClick={() => { setSharesAuto(true); applyEvenSplit(total); }}>Поровну</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div className="avatar avatar-you" style={{ width: 22, height: 22, fontSize: 8.5 }}>Вы</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Вы</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="number" inputMode="numeric" className="amt-input" value={shareYou} onChange={(e) => { setShareYou(e.target.value.replace(/\D/g, "")); setSharesAuto(false); }} aria-label="Сколько вложили вы" />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>₽</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div className="avatar avatar-partner" style={{ width: 22, height: 22, fontSize: 9 }}>{(partner?.username ?? "П").slice(0, 1).toUpperCase()}</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{partner?.username ?? "Партнёр"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="number" inputMode="numeric" className="amt-input" value={sharePartner} onChange={(e) => { setSharePartner(e.target.value.replace(/\D/g, "")); setSharesAuto(false); }} aria-label="Сколько вложил партнёр" />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>₽</span>
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11.5, fontWeight: 600, color: total && sharesSum === total ? "var(--forest-dark)" : "var(--rust)" }}>{splitHint}</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Дата</label>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="button" className={`submit-btn${type === "EXPENSE" ? " rust" : ""}`} disabled={!formValid} onClick={submit}>
          {type === "EXPENSE" ? "Добавить расход" : "Добавить доход"}
        </button>

        {submitted && (
          <div className="toast-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            Операция добавлена
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="serif card-title">История</h2>
        <div className="segmented compact" style={{ margin: "12px 0" }}>
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Все</button>
          <button type="button" className={filter === "INCOME" ? "active" : ""} onClick={() => setFilter("INCOME")}>Доходы</button>
          <button type="button" className={filter === "EXPENSE" ? "active" : ""} onClick={() => setFilter("EXPENSE")}>Расходы</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((t) => (
            <div key={t.id} className="tx-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div className="tx-icon"><TwoPathIcon paths={categoryIcon(t.category?.name ?? "Зарплата")} size={13} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span className="tx-title">{txTitle(t)}</span>
                  <span className="tx-meta">{txMeta(t, members, currentUserId)}</span>
                </div>
              </div>
              <span className="tx-amount" style={{ color: txAmountColor(t) }}>{txAmountLabel(t)}</span>
            </div>
          ))}
          {items.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Нет операций</p>}
        </div>
      </div>
    </div>
  );
}
