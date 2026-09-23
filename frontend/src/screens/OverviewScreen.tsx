import { useAppStore } from "../store/store";
import { formatMoney } from "../lib/money";
import { currentPeriod } from "../lib/period";
import { txAmountColor, txAmountLabel, txIcon, txMeta, txTitle } from "../lib/txDisplay";
import { Avatar } from "../components/Avatar";
import { useCategoriesQuery } from "../graphql/operations/categories.generated";
import { useSummaryQuery } from "../graphql/operations/summary.generated";
import { useTransactionsQuery } from "../graphql/operations/transactions.generated";
import type { Screen } from "../types";

const categoriesContext = { additionalTypenames: ["Category"] };
const summaryContext = { additionalTypenames: ["Transaction", "GoalContribution"] };
const transactionsContext = { additionalTypenames: ["Transaction", "GoalContribution"] };

export function OverviewScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { currentUser, activeGroup } = useAppStore();
  const groupId = activeGroup?.id ?? "";
  const period = currentPeriod();

  const [summaryResult] = useSummaryQuery({ variables: { groupId, period }, pause: !groupId, context: summaryContext });
  const [categoriesResult] = useCategoriesQuery({ variables: { groupId }, pause: !groupId, context: categoriesContext });
  const [recentResult] = useTransactionsQuery({ variables: { groupId, first: 3 }, pause: !groupId, context: transactionsContext });

  const members = activeGroup?.members.map((m) => ({ userId: m.userId, username: m.username })) ?? [];

  if (!activeGroup) return null;

  const summary = summaryResult.data?.summary;
  const balance = summary?.balance.amount ?? 0;
  const income = summary?.income.total.amount ?? 0;
  const expense = summary?.expense.total.amount ?? 0;
  const net = income - expense;
  const spentByCategory = new Map((summary?.expense.byCategory ?? []).map((c) => [c.categoryId, c.amount.amount]));
  const expenseByMember = new Map((summary?.expense.byMember ?? []).map((m) => [m.userId, m.amount.amount]));

  const topCats = (categoriesResult.data?.categories ?? [])
    .filter((c) => c.monthlyLimit)
    .slice(0, 3)
    .map((c) => {
      const spent = spentByCategory.get(c.id) ?? 0;
      const limit = c.monthlyLimit?.amount ?? 0;
      const over = spent > limit;
      const near = !over && limit > 0 && spent / limit >= 0.85;
      return {
        ...c,
        spent,
        limit,
        color: over ? "var(--rust)" : near ? "var(--gold)" : "var(--forest)",
        textColor: over ? "var(--rust)" : "var(--ink-soft)",
        width: `${Math.min(100, limit ? Math.round((spent / limit) * 100) : 0)}%`,
      };
    });

  const recent = recentResult.data?.transactions.items ?? [];
  const currentUserId = currentUser?.id;
  const partner = activeGroup.members.find((m) => !m.self);

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: "var(--forest)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FAF8F1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 1 1-3-6.2" />
              <path d="M20 5v5h-5" />
            </svg>
          </div>
          <span className="serif" style={{ fontSize: 16.5, fontWeight: 600 }}>Кошелё4ек</span>
        </div>
        <button type="button" onClick={() => onNavigate("group")} aria-label="Группа и участники" style={{ display: "flex", alignItems: "center", gap: 7, border: "none", background: "none", padding: "4px 0" }}>
          <div style={{ display: "flex" }}>
            <Avatar label="Вы" self style={{ border: "2px solid var(--ivory)" }} />
            {partner && <Avatar label={partner.username.slice(0, 1).toUpperCase()} self={false} style={{ marginLeft: -7, border: "2px solid var(--ivory)" }} />}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E6759" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="page-header">
        <h1 className="serif">Обзор бюджета</h1>
        <p>{activeGroup.name}</p>
      </div>

      <div className="card">
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-soft)" }}>Общий баланс</span>
        <div className="serif" style={{ marginTop: 8, fontSize: 30, fontWeight: 600 }}>{formatMoney(balance)} ₽</div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: net >= 0 ? "var(--forest-dark)" : "var(--rust)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d={net >= 0 ? "M5 12l7-7 7 7" : "M5 12l7 7 7-7"} />
          </svg>
          {net >= 0 ? "+" : "−"}{formatMoney(Math.abs(net))} ₽ за месяц
        </div>
      </div>

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

      {activeGroup.members.length > 1 && (
        <div className="card">
          <h2 className="serif card-title" style={{ margin: 0 }}>Расходы по участникам</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {activeGroup.members.map((m, i) => (
              <div key={m.userId} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar label={m.self ? "Вы" : m.username.slice(0, 1).toUpperCase()} self={m.self} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.self ? "Вы" : m.username}</span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{formatMoney(expenseByMember.get(m.userId) ?? 0)} ₽</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCats.length > 0 && (
        <div className="card">
          <div className="card-head-row">
            <h2 className="serif card-title" style={{ margin: 0 }}>Бюджет по категориям</h2>
            <button type="button" className="link-btn" onClick={() => onNavigate("budget")}>Все →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topCats.map((c) => (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: c.textColor, fontWeight: 600 }}>{formatMoney(c.spent)} / {formatMoney(c.limit)} ₽</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ background: c.color, width: c.width }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head-row">
          <h2 className="serif card-title" style={{ margin: 0 }}>Последние операции</h2>
          <button type="button" className="link-btn" onClick={() => onNavigate("tx")}>Все →</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {recent.map((t) => (
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
          {recent.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Пока нет операций</p>}
        </div>
      </div>
    </div>
  );
}
