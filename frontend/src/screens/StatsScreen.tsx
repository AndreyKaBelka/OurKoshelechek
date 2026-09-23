import { useState } from "react";
import { useAppStore } from "../store/store";
import { formatMoney } from "../lib/money";
import { isoDate } from "../lib/period";
import { txAmountColor, txAmountLabel, txIcon, txMeta, txTitle } from "../lib/txDisplay";
import { Avatar } from "../components/Avatar";
import { useCategoriesQuery } from "../graphql/operations/categories.generated";
import { usePeriodSummaryQuery } from "../graphql/operations/summary.generated";
import { useTransactionsQuery } from "../graphql/operations/transactions.generated";

const categoriesContext = { additionalTypenames: ["Category"] };
const summaryContext = { additionalTypenames: ["Transaction", "GoalContribution"] };
const transactionsContext = { additionalTypenames: ["Transaction", "GoalContribution"] };

/** Upper bound on operations shown for a period; the rest is reported as "показаны N из M". */
const MAX_ITEMS = 500;

/** Bar colors for members: the viewer first, then the others in group order. */
const MEMBER_COLORS = ["var(--forest)", "var(--partner)", "var(--gold)", "var(--rust)"];

type Preset = "week" | "month" | "prevMonth" | "custom";

function presetRange(preset: Exclude<Preset, "custom">): [string, string] {
  const now = new Date();
  if (preset === "week") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return [isoDate(from), isoDate(now)];
  }
  if (preset === "month") {
    return [isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), isoDate(now)];
  }
  return [isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), isoDate(new Date(now.getFullYear(), now.getMonth(), 0))];
}

export function StatsScreen() {
  const { currentUser, activeGroup } = useAppStore();
  const groupId = activeGroup?.id ?? "";

  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState<[string, string]>(() => presetRange("month"));
  const [dateFrom, dateTo] = range;
  const validRange = Boolean(dateFrom && dateTo && dateFrom <= dateTo);

  function applyPreset(next: Exclude<Preset, "custom">) {
    setPreset(next);
    setRange(presetRange(next));
  }

  function changeDate(index: 0 | 1, value: string) {
    setPreset("custom");
    setRange((prev) => (index === 0 ? [value, prev[1]] : [prev[0], value]));
  }

  const pause = !groupId || !validRange;
  const [summaryResult] = usePeriodSummaryQuery({ variables: { groupId, dateFrom, dateTo }, pause, context: summaryContext });
  const [categoriesResult] = useCategoriesQuery({ variables: { groupId }, pause: !groupId, context: categoriesContext });
  const [txResult] = useTransactionsQuery({
    variables: {
      groupId,
      filter: { dateFrom: `${dateFrom}T00:00:00Z`, dateTo: `${dateTo}T23:59:59.999Z` },
      first: MAX_ITEMS,
    },
    pause,
    context: transactionsContext,
  });

  if (!activeGroup) return null;

  const currentUserId = currentUser?.id;
  const members = activeGroup.members.map((m) => ({ userId: m.userId, username: m.username }));
  const orderedMembers = [...activeGroup.members].sort((a, b) => Number(b.self) - Number(a.self));
  const memberColor = new Map(orderedMembers.map((m, i) => [m.userId, MEMBER_COLORS[i % MEMBER_COLORS.length]]));
  const memberName = (userId: string) => {
    const m = activeGroup.members.find((x) => x.userId === userId);
    return !m ? "Участник" : m.self ? "Вы" : m.username;
  };
  const showMembers = activeGroup.members.length > 1;

  const summary = summaryResult.data?.periodSummary;
  const income = summary?.income.total.amount ?? 0;
  const expense = summary?.expense.total.amount ?? 0;
  const incomeByMember = new Map((summary?.income.byMember ?? []).map((m) => [m.userId, m.amount.amount]));
  const expenseByMember = new Map((summary?.expense.byMember ?? []).map((m) => [m.userId, m.amount.amount]));

  const categoryById = new Map((categoriesResult.data?.categories ?? []).map((c) => [c.id, c]));
  const categories = (summary?.expense.byCategory ?? [])
    .map((c) => ({
      id: c.categoryId,
      name: categoryById.get(c.categoryId)?.name ?? "Категория",
      icon: categoryById.get(c.categoryId)?.icon || "💰",
      amount: c.amount.amount,
      byMember: new Map(c.byMember.map((m) => [m.userId, m.amount.amount])),
    }))
    .sort((a, b) => b.amount - a.amount);
  // Expenses whose category was deleted are excluded from byCategory but still count in the total.
  const uncategorized = expense - categories.reduce((sum, c) => sum + c.amount, 0);
  const maxCategory = Math.max(uncategorized, ...categories.map((c) => c.amount), 1);

  const txList = txResult.data?.transactions;
  const items = txList?.items ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="serif">Статистика</h1>
        <p>{activeGroup.name}</p>
      </div>

      <div className="card">
        <div className="segmented compact">
          <button type="button" className={preset === "week" ? "active" : ""} onClick={() => applyPreset("week")}>7 дней</button>
          <button type="button" className={preset === "month" ? "active" : ""} onClick={() => applyPreset("month")}>Этот месяц</button>
          <button type="button" className={preset === "prevMonth" ? "active" : ""} onClick={() => applyPreset("prevMonth")}>Прошлый</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span className="field-label">С</span>
            <input type="date" className="field" value={dateFrom} max={dateTo || undefined} onChange={(e) => changeDate(0, e.target.value)} />
          </label>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span className="field-label">По</span>
            <input type="date" className="field" value={dateTo} min={dateFrom || undefined} onChange={(e) => changeDate(1, e.target.value)} />
          </label>
        </div>
        {!validRange && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--rust)" }}>Выберите период: дата начала не может быть позже даты окончания</p>
        )}
      </div>

      {summaryResult.error && <p style={{ fontSize: 12.5, color: "var(--rust)" }}>Не удалось загрузить статистику</p>}

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-tile-label">Доходы</span>
          <div className="serif stat-tile-value" style={{ fontSize: 19, marginTop: 6 }}>{formatMoney(income)} ₽</div>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-label">Расходы</span>
          <div className="serif stat-tile-value" style={{ fontSize: 19, marginTop: 6 }}>{formatMoney(expense)} ₽</div>
        </div>
      </div>

      {showMembers && (
        <div className="card">
          <h2 className="serif card-title" style={{ margin: 0 }}>Кто сколько</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {orderedMembers.map((m, i) => (
              <div key={m.userId} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 0",
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Avatar label={m.self ? "Вы" : m.username.slice(0, 1).toUpperCase()} self={m.self} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.self ? "Вы" : m.username}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>−{formatMoney(expenseByMember.get(m.userId) ?? 0)} ₽</span>
                  <span style={{ fontSize: 11.5, color: "var(--forest-dark)" }}>+{formatMoney(incomeByMember.get(m.userId) ?? 0)} ₽</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="serif card-title" style={{ margin: 0 }}>Расходы по категориям</h2>
        {showMembers && categories.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 11.5, color: "var(--ink-soft)" }}>
            {orderedMembers.map((m) => (
              <span key={m.userId} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: memberColor.get(m.userId) }} />
                {m.self ? "Вы" : m.username}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {categories.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{c.icon} {c.name}</span>
                <span style={{ fontWeight: 700 }}>{formatMoney(c.amount)} ₽</span>
              </div>
              <div className="progress-track" style={{ display: "flex" }}>
                <div style={{ display: "flex", width: `${Math.round((c.amount / maxCategory) * 100)}%`, height: "100%" }}>
                  {orderedMembers.map((m) => {
                    const part = c.byMember.get(m.userId) ?? 0;
                    if (part <= 0) return null;
                    return <div key={m.userId} style={{ flex: part, background: showMembers ? memberColor.get(m.userId) : "var(--forest)" }} />;
                  })}
                </div>
              </div>
              {showMembers && (
                <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                  {[...c.byMember.entries()]
                    .filter(([, amount]) => amount > 0)
                    .sort(([a], [b]) => orderedMembers.findIndex((m) => m.userId === a) - orderedMembers.findIndex((m) => m.userId === b))
                    .map(([userId, amount]) => `${memberName(userId)} ${formatMoney(amount)} ₽`)
                    .join(" · ")}
                </span>
              )}
            </div>
          ))}
          {uncategorized > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>Без категории</span>
                <span style={{ fontWeight: 700 }}>{formatMoney(uncategorized)} ₽</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ background: "var(--ink-faint)", width: `${Math.round((uncategorized / maxCategory) * 100)}%` }} /></div>
            </div>
          )}
          {categories.length === 0 && uncategorized <= 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Нет расходов за период</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head-row">
          <h2 className="serif card-title" style={{ margin: 0 }}>Операции</h2>
          {txList && <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{txList.total}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((t) => (
            <div key={t.id} className="tx-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div className="tx-icon"><span style={{ fontSize: 14 }}>{txIcon(t)}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span className="tx-title">{txTitle(t)}</span>
                  <span className="tx-meta">{txMeta(t, members, currentUserId)}</span>
                </div>
              </div>
              <span className="tx-amount" style={{ color: txAmountColor(t, currentUserId) }}>{txAmountLabel(t, currentUserId)}</span>
            </div>
          ))}
          {txList?.hasMore && (
            <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>Показаны первые {items.length} из {txList.total}</p>
          )}
          {items.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Нет операций за период</p>}
        </div>
      </div>
    </div>
  );
}
