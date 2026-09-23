import { useEffect, useRef, useState } from "react";
import { useAppStore, authErrorMessage } from "../store/store";
import { formatMoney, kopecksToRoubleInput, roublesToKopecks } from "../lib/money";
import { AmountInput } from "../components/AmountInput";
import { txAmountColor, txAmountLabel, txIcon, txMeta, txTitle } from "../lib/txDisplay";
import { useCategoriesQuery } from "../graphql/operations/categories.generated";
import {
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useTransactionsQuery,
  useUpdateTransactionMutation,
} from "../graphql/operations/transactions.generated";
import type { TransactionsQuery } from "../graphql/operations/transactions.generated";
import type { PayerInput, TransactionFilter, TransactionType } from "../graphql/types";

type TransactionItem = TransactionsQuery["transactions"]["items"][number];

type PayerChoice = "you" | "partner" | "split";
type TransferDirection = "toPartner" | "fromPartner";
type Filter = "all" | "INCOME" | "EXPENSE" | "TRANSFER";

const categoriesContext = { additionalTypenames: ["Category"] };
const transactionsContext = { additionalTypenames: ["Transaction", "GoalContribution"] };
const PAGE_SIZE = 30;

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
  const [transferDirection, setTransferDirection] = useState<TransferDirection>("toPartner");
  const [shareYou, setShareYou] = useState("");
  const [sharePartner, setSharePartner] = useState("");
  const [sharesAuto, setSharesAuto] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = !!editingId;

  if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);

  const [, createTransaction] = useCreateTransactionMutation();
  const [, updateTransaction] = useUpdateTransactionMutation();
  const [, deleteTransaction] = useDeleteTransactionMutation();

  const total = roublesToKopecks(parseInt(amount.replace(/\D/g, ""), 10) || 0);
  const shareYouK = roublesToKopecks(parseInt(shareYou.replace(/\D/g, ""), 10) || 0);
  const sharePartnerK = roublesToKopecks(parseInt(sharePartner.replace(/\D/g, ""), 10) || 0);
  const sharesSum = shareYouK + sharePartnerK;
  const isTransfer = type === "TRANSFER";
  const isSplit = !isTransfer && payerChoice === "split";
  const formValid =
    !!total &&
    (type !== "EXPENSE" || !!categoryId) &&
    (!isSplit || sharesSum === total) &&
    (!isTransfer || !!partner);

  if (!activeGroup) return null;

  function applyEvenSplit(totalK: number) {
    const half = Math.floor(totalK / 2);
    setShareYou(totalK ? kopecksToRoubleInput(totalK - half) : "");
    setSharePartner(totalK ? kopecksToRoubleInput(half) : "");
  }

  function onShareChange(who: "you" | "partner", raw: string) {
    const digits = raw.replace(/\D/g, "");
    const enteredK = roublesToKopecks(parseInt(digits, 10) || 0);
    const restK = total ? Math.max(0, total - enteredK) : 0;
    const restInput = total ? kopecksToRoubleInput(restK) : "";
    if (who === "you") {
      setShareYou(digits);
      setSharePartner(restInput);
    } else {
      setSharePartner(digits);
      setShareYou(restInput);
    }
    setSharesAuto(false);
  }

  function onAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setAmount(digits);
    if (isSplit && sharesAuto) applyEvenSplit(roublesToKopecks(parseInt(digits, 10) || 0));
  }

  async function submit() {
    if (!formValid || !currentUserId || !activeGroup) return;
    const now = new Date();
    // Пополнение цели без явной даты сохраняется с текущим временем
    // (time.Now() на бэкенде), поэтому ручная операция за "сегодня" тоже
    // должна нести реальное время, а не полночь — иначе она всегда
    // сортируется ниже более раннего доната того же дня.
    const dateIso = date === now.toISOString().slice(0, 10) ? now.toISOString() : `${date}T00:00:00Z`;
    let payer: PayerInput;
    let recipientUserId: string | null = null;
    if (isTransfer) {
      const partnerId = partner?.userId ?? currentUserId;
      const [from, to] = transferDirection === "toPartner" ? [currentUserId, partnerId] : [partnerId, currentUserId];
      payer = { mode: "USER", userId: from, shares: null };
      recipientUserId = to;
    } else if (payerChoice === "you") payer = { mode: "USER", userId: currentUserId, shares: null };
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

    const input = {
      type,
      amount: { amount: total },
      categoryId: type === "EXPENSE" ? categoryId : null,
      payer,
      recipientUserId,
      date: dateIso,
      comment: comment.trim() || null,
    };
    const result = editingId
      ? await updateTransaction({ groupId: activeGroup.id, transactionId: editingId, input })
      : await createTransaction({ groupId: activeGroup.id, input });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setError("");
    resetForm();
    setSubmitted(true);
  }

  function resetForm() {
    setEditingId(null);
    setType("EXPENSE");
    setAmount("");
    setComment("");
    setCategoryId("");
    setPayerChoice("split");
    setTransferDirection("toPartner");
    setShareYou("");
    setSharePartner("");
    setSharesAuto(true);
    setDate(new Date().toISOString().slice(0, 10));
  }

  function startEdit(t: TransactionItem) {
    setSubmitted(false);
    setError("");
    setEditingId(t.id);
    setType(t.type);
    setAmount(kopecksToRoubleInput(t.amount.amount));
    setComment(t.comment ?? "");
    if (t.category) setCategoryId(t.category.id);
    if (t.type === "TRANSFER") {
      setTransferDirection(t.payer.userId === currentUserId ? "toPartner" : "fromPartner");
    } else if (t.payer.mode === "SPLIT" && t.payer.shares) {
      setPayerChoice("split");
      setSharesAuto(false);
      setShareYou(kopecksToRoubleInput(t.payer.shares.find((s) => s.userId === currentUserId)?.amount.amount ?? 0));
      setSharePartner(kopecksToRoubleInput(t.payer.shares.find((s) => s.userId !== currentUserId)?.amount.amount ?? 0));
    } else {
      setPayerChoice(t.payer.userId === currentUserId ? "you" : "partner");
    }
    setDate(t.date.slice(0, 10));
  }

  async function removeTransaction(transactionId: string) {
    if (!activeGroup) return;
    if (!window.confirm("Удалить операцию? Это действие нельзя отменить.")) return;
    const result = await deleteTransaction({ groupId: activeGroup.id, transactionId });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    if (editingId === transactionId) resetForm();
    setError("");
  }

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
        {isEditing && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 className="serif card-title" style={{ margin: 0 }}>Редактирование операции</h2>
            <button type="button" className="link-btn" onClick={resetForm}>Отмена</button>
          </div>
        )}

        <div className="segmented" style={{ marginBottom: 16 }}>
          <button type="button" className={type === "EXPENSE" ? "active" : ""} style={type === "EXPENSE" ? { background: "var(--rust)", color: "#fff" } : undefined} onClick={() => setType("EXPENSE")}>Расход</button>
          <button type="button" className={type === "INCOME" ? "active" : ""} style={type === "INCOME" ? { background: "var(--forest)", color: "#fff" } : undefined} onClick={() => setType("INCOME")}>Доход</button>
          <button type="button" className={isTransfer ? "active" : ""} style={isTransfer ? { background: "var(--gold)", color: "#fff" } : undefined} onClick={() => setType("TRANSFER")}>Перевод</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Сумма</label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 14px" }}>
            <AmountInput placeholder="0" className="serif" value={amount} onChange={onAmountChange} style={{ flex: 1, border: "none", outline: "none", fontSize: 24, fontWeight: 600, background: "none", minWidth: 0 }} />
            <span className="serif" style={{ fontSize: 18, color: "var(--ink-faint)" }}>₽</span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Комментарий</label>
          <input type="text" className="field" placeholder="Например, продукты во ВкусВилле" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        {type === "EXPENSE" && (
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

        {isTransfer && (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Кто кому переводит</label>
            {partner ? (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className={`choice-btn${transferDirection === "toPartner" ? " active-forest" : ""}`} onClick={() => setTransferDirection("toPartner")}>Вы → {partner.username}</button>
                  <button type="button" className={`choice-btn${transferDirection === "fromPartner" ? " active-partner" : ""}`} onClick={() => setTransferDirection("fromPartner")}>{partner.username} → Вы</button>
                </div>
                <p style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-soft)" }}>
                  {transferDirection === "toPartner" ? "У вас это будет расход" : `У ${partner.username} это будет расход`}, у получателя — доход. Общий баланс не меняется.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Для перевода в группе должен быть ещё один участник</p>
            )}
          </div>
        )}

        {!isTransfer && (
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
                    <AmountInput className="amt-input" value={shareYou} onChange={(d) => onShareChange("you", d)} aria-label="Сколько вложили вы" />
                    <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>₽</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div className="avatar avatar-partner" style={{ width: 22, height: 22, fontSize: 9 }}>{(partner?.username ?? "П").slice(0, 1).toUpperCase()}</div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{partner?.username ?? "Партнёр"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <AmountInput className="amt-input" value={sharePartner} onChange={(d) => onShareChange("partner", d)} aria-label="Сколько вложил партнёр" />
                    <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>₽</span>
                  </div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11.5, fontWeight: 600, color: total && sharesSum === total ? "var(--forest-dark)" : "var(--rust)" }}>{splitHint}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Дата</label>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="button" className={`submit-btn${type === "EXPENSE" ? " rust" : ""}`} disabled={!formValid} onClick={submit}>
          {isEditing ? "Сохранить изменения" : type === "EXPENSE" ? "Добавить расход" : isTransfer ? "Добавить перевод" : "Добавить доход"}
        </button>

        {isEditing && (
          <button
            type="button"
            onClick={() => editingId && removeTransaction(editingId)}
            style={{ width: "100%", marginTop: 8, border: "none", borderRadius: 11, padding: "13px 0", fontSize: 13.5, fontWeight: 700, color: "var(--rust)", background: "var(--ivory)" }}
          >
            Удалить операцию
          </button>
        )}

        {submitted && (
          <div className="toast-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            {isEditing ? "Операция обновлена" : "Операция добавлена"}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="serif card-title">История</h2>
        <div className="segmented compact" style={{ margin: "12px 0" }}>
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Все</button>
          <button type="button" className={filter === "INCOME" ? "active" : ""} onClick={() => setFilter("INCOME")}>Доходы</button>
          <button type="button" className={filter === "EXPENSE" ? "active" : ""} onClick={() => setFilter("EXPENSE")}>Расходы</button>
          <button type="button" className={filter === "TRANSFER" ? "active" : ""} onClick={() => setFilter("TRANSFER")}>Переводы</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TransactionsPage
            key={`${groupId}:${filter}`}
            groupId={groupId}
            filter={filter === "all" ? undefined : { type: filter }}
            members={members}
            currentUserId={currentUserId}
            editingId={editingId}
            onEdit={startEdit}
          />
        </div>
      </div>
    </div>
  );
}

type TransactionsPageProps = {
  groupId: string;
  filter?: TransactionFilter;
  after?: string;
  members: { userId: string; username: string }[];
  currentUserId?: string;
  editingId: string | null;
  onEdit: (t: TransactionItem) => void;
};

// One page of the history. Each page is its own urql query, so a mutation invalidating
// "Transaction" refetches every loaded page, and the next page's cursor is always read
// from the live data of the previous one (a deleted last row can't leave a stale cursor).
// Scrolling to the sentinel below the last row mounts the next page.
function TransactionsPage({ groupId, filter, after, members, currentUserId, editingId, onEdit }: TransactionsPageProps) {
  const [result, reexecute] = useTransactionsQuery({
    variables: { groupId, filter, first: PAGE_SIZE, after },
    pause: !groupId,
    context: transactionsContext,
  });
  const [loadNext, setLoadNext] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const list = result.data?.transactions;
  const nextCursor = list?.hasMore ? list.nextCursor : null;
  const waitingForScroll = !!nextCursor && !loadNext;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!waitingForScroll || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLoadNext(true);
      },
      // Start loading a bit before the user actually reaches the end.
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [waitingForScroll]);

  const items = list?.items ?? [];
  return (
    <>
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tx-row"
          onClick={() => onEdit(t)}
          style={{ width: "100%", border: "none", background: t.id === editingId ? "var(--ivory)" : "none", borderRadius: 10, cursor: "pointer", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div className="tx-icon"><span style={{ fontSize: 14 }}>{txIcon(t)}</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span className="tx-title">{txTitle(t)}</span>
              <span className="tx-meta">{txMeta(t, members, currentUserId)}</span>
            </div>
          </div>
          <span className="tx-amount" style={{ color: txAmountColor(t, currentUserId) }}>{txAmountLabel(t, currentUserId)}</span>
        </button>
      ))}
      {!after && !result.fetching && !result.error && items.length === 0 && (
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Нет операций</p>
      )}
      {result.fetching && !list && <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Подождите…</p>}
      {result.error && !list && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--rust)" }}>
          Не удалось загрузить операции
          <button type="button" className="link-btn" onClick={() => reexecute({ requestPolicy: "network-only" })}>Повторить</button>
        </div>
      )}
      {waitingForScroll && <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />}
      {loadNext && nextCursor && (
        <TransactionsPage
          groupId={groupId}
          filter={filter}
          after={nextCursor}
          members={members}
          currentUserId={currentUserId}
          editingId={editingId}
          onEdit={onEdit}
        />
      )}
    </>
  );
}
