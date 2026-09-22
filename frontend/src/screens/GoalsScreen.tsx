import { useState } from "react";
import { useAppStore, authErrorMessage } from "../store/store";
import { formatMoney, roublesToKopecks } from "../lib/money";
import { goalIcon, TwoPathIcon } from "../lib/icons";
import { currentPeriod } from "../lib/period";
import { BottomSheet } from "../components/BottomSheet";
import { Avatar } from "../components/Avatar";
import { useCategoriesQuery } from "../graphql/operations/categories.generated";
import {
  useContributeToGoalMutation,
  useCreateGoalMutation,
  useDeleteGoalMutation,
  useGoalsQuery,
  useUpdateGoalMutation,
  useWithdrawFromGoalMutation,
} from "../graphql/operations/goals.generated";
import { useSummaryQuery } from "../graphql/operations/summary.generated";
import type { GoalType } from "../graphql/types";

const SAVINGS_CATEGORY_NAME = "Накопления";
const goalsContext = { additionalTypenames: ["Goal", "GoalContribution"] };
const categoriesContext = { additionalTypenames: ["Category"] };
const summaryContext = { additionalTypenames: ["Transaction", "GoalContribution"] };

export function GoalsScreen() {
  const { activeGroup } = useAppStore();
  const groupId = activeGroup?.id ?? "";
  const period = currentPeriod();

  const [goalsResult] = useGoalsQuery({ variables: { groupId }, pause: !groupId, context: goalsContext });
  const [categoriesResult] = useCategoriesQuery({ variables: { groupId }, pause: !groupId, context: categoriesContext });
  const [summaryResult] = useSummaryQuery({ variables: { groupId, period }, pause: !groupId, context: summaryContext });
  const [, createGoalMutation] = useCreateGoalMutation();
  const [, updateGoalMutation] = useUpdateGoalMutation();
  const [, deleteGoalMutation] = useDeleteGoalMutation();
  const [, contributeMutation] = useContributeToGoalMutation();
  const [, withdrawMutation] = useWithdrawFromGoalMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("SHARED");
  const [sheetGoalId, setSheetGoalId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<"topup" | "withdraw">("topup");
  const [topupAmount, setTopupAmount] = useState("");
  const [error, setError] = useState("");

  if (!activeGroup) return null;

  const goals = goalsResult.data?.goals ?? [];
  const savedTotal = goals.reduce((a, g) => a + g.currentAmount.amount, 0);
  const savingsCategoryId = categoriesResult.data?.categories.find((c) => c.name === SAVINGS_CATEGORY_NAME)?.id;
  const monthSavedTotal = summaryResult.data?.summary.expense.byCategory.find((c) => c.categoryId === savingsCategoryId)?.amount.amount ?? 0;
  const sheetGoal = goals.find((g) => g.id === sheetGoalId) ?? null;

  const targetK = roublesToKopecks(parseInt(target.replace(/\D/g, ""), 10) || 0);
  const formValid = !!name.trim() && !!targetK;
  const isEditing = !!editingGoalId;

  function closeForm() {
    setFormOpen(false);
    setEditingGoalId(null);
    setName("");
    setTarget("");
    setSaved("");
    setGoalType("SHARED");
  }

  function openCreateForm() {
    setEditingGoalId(null);
    setError("");
    setFormOpen(true);
  }

  function openEditForm(goalId: string) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    setEditingGoalId(goalId);
    setName(goal.name);
    setTarget(String(Math.round(goal.targetAmount.amount / 100)));
    setSaved("");
    setGoalType(goal.type);
    setError("");
    setFormOpen(true);
  }

  async function saveGoal() {
    if (!formValid || !activeGroup) return;
    if (isEditing && editingGoalId) {
      const result = await updateGoalMutation({
        groupId: activeGroup.id,
        goalId: editingGoalId,
        input: { name: name.trim(), targetAmount: { amount: targetK } },
      });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      setError("");
      closeForm();
      return;
    }
    const result = await createGoalMutation({
      groupId: activeGroup.id,
      input: { name: name.trim(), icon: goalType === "SHARED" ? "shield" : "laptop", targetAmount: { amount: targetK }, type: goalType },
    });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    const savedK = roublesToKopecks(parseInt(saved.replace(/\D/g, ""), 10) || 0);
    if (savedK > 0 && result.data) {
      const contribution = await contributeMutation({ groupId: activeGroup.id, goalId: result.data.createGoal.id, input: { amount: { amount: savedK } } });
      if (contribution.error) {
        setError(authErrorMessage(contribution.error));
        return;
      }
    }
    setError("");
    closeForm();
  }

  async function removeGoal(goalId: string, goalName: string) {
    if (!activeGroup) return;
    if (!window.confirm(`Удалить цель «${goalName}»? Это действие нельзя отменить.`)) return;
    const result = await deleteGoalMutation({ groupId: activeGroup.id, goalId });
    if (result.error) setError(authErrorMessage(result.error));
  }

  function closeSheet() {
    setSheetGoalId(null);
    setSheetMode("topup");
    setTopupAmount("");
  }

  function openSheet(goalId: string, mode: "topup" | "withdraw") {
    setSheetGoalId(goalId);
    setSheetMode(mode);
    setTopupAmount("");
    setError("");
  }

  async function topup(amountK: number) {
    if (!sheetGoalId || !activeGroup || !amountK) return;
    const result = await contributeMutation({ groupId: activeGroup.id, goalId: sheetGoalId, input: { amount: { amount: amountK } } });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setError("");
    closeSheet();
  }

  async function withdraw(amountK: number) {
    if (!sheetGoalId || !activeGroup || !amountK) return;
    const result = await withdrawMutation({ groupId: activeGroup.id, goalId: sheetGoalId, input: { amount: { amount: amountK } } });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setError("");
    closeSheet();
  }

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="page-header">
          <h1 className="serif">Цели накоплений</h1>
          <p>Общие и личные — копите вместе</p>
        </div>
        <button type="button" aria-label="Добавить цель" onClick={openCreateForm} style={{ border: "none", background: "var(--forest)", color: "#fff", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="stat-row">
        <div className="stat-tile"><span className="stat-tile-label">Отложено</span><div className="stat-tile-value">{formatMoney(savedTotal)} ₽</div></div>
        <div className="stat-tile"><span className="stat-tile-label">Целей</span><div className="stat-tile-value">{goals.length}</div></div>
        <div className="stat-tile"><span className="stat-tile-label">За месяц</span><div className="stat-tile-value">{formatMoney(monthSavedTotal)} ₽</div></div>
      </div>

      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <radialGradient id="heart3dPink" cx="34%" cy="26%" r="78%">
            <stop offset="0%" stopColor="#FFD5E0" />
            <stop offset="45%" stopColor="#F2A0B5" />
            <stop offset="100%" stopColor="#C05F7C" />
          </radialGradient>
          <radialGradient id="heart3dIdle" cx="34%" cy="26%" r="78%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#EFE9DA" />
            <stop offset="100%" stopColor="#C6BCA6" />
          </radialGradient>
        </defs>
      </svg>

      {goals.map((g) => {
        const target = g.targetAmount.amount;
        const current = g.currentAmount.amount;
        const pct = target ? Math.round((current / target) * 100) : 0;
        const done = pct >= 100;
        const remain = Math.max(0, target - current);
        const width = `${Math.min(100, pct)}%`;
        return (
          <div key={g.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: g.type === "SHARED" ? "var(--forest-soft)" : "var(--partner-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: g.type === "SHARED" ? "var(--forest-dark)" : "var(--partner)", flexShrink: 0 }}>
                <TwoPathIcon paths={goalIcon(g.icon)} size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Цель — {formatMoney(target)} ₽</div>
              </div>
              <button type="button" className="row-trash" aria-label="Редактировать цель" onClick={() => openEditForm(g.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
              <button type="button" className="row-trash" aria-label="Удалить цель" onClick={() => removeGoal(g.id, g.name)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg>
              </button>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{formatMoney(current)} ₽</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--forest-dark)" }}>{pct}%</span>
              </div>
              <div style={{ position: "relative", margin: "6px 16px 6px 0" }}>
                <div className="progress-track"><div className="progress-fill" style={{ background: "var(--forest)", width }} /></div>
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  style={{ position: "absolute", top: "50%", transform: "translate(-50%, -50%)", transition: "left .25s ease", left: width, filter: done ? "drop-shadow(0 2px 3px rgba(120,40,60,.35)) drop-shadow(0 0 8px rgba(242,160,181,.95))" : "drop-shadow(0 2px 3px rgba(34,31,26,.22))" }}
                >
                  <path d="M12 21.2C9.2 19.4 3 15 3 10.4A5.4 5.4 0 0 1 12 6.6a5.4 5.4 0 0 1 9 3.8c0 4.6-6.2 9-9 10.8z" fill={done ? "url(#heart3dPink)" : "url(#heart3dIdle)"} stroke={done ? "rgba(160,64,90,.55)" : "rgba(167,158,140,.6)"} strokeWidth="1" />
                  <ellipse cx="8.6" cy="10.2" rx="2.1" ry="1.4" fill="#ffffff" opacity={done ? 0.8 : 0.55} transform="rotate(-28 8.6 10.2)" />
                </svg>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-soft)" }}>
              <div style={{ display: "flex" }}>
                <Avatar label="Вы" self size={18} />
                {g.type === "SHARED" && <Avatar label={(activeGroup.members.find((m) => !m.self)?.username ?? "П").slice(0, 1).toUpperCase()} self={false} size={18} style={{ marginLeft: -5 }} />}
              </div>
              {g.type === "SHARED" ? "Общая — поровну" : "Личная"}
              {remain > 0 ? ` · осталось ${formatMoney(remain)} ₽` : current > target ? ` · цель закрыта, сверху ${formatMoney(current - target)} ₽` : " · цель закрыта"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="topup-btn" style={{ flex: 1, border: "1.5px solid var(--forest)", background: "none", color: "var(--forest-dark)", fontWeight: 600, fontSize: 13, padding: "13px 0", borderRadius: 9 }} onClick={() => openSheet(g.id, "topup")}>Пополнить</button>
              {current > 0 && (
                <button type="button" className="topup-btn" style={{ flex: 1, border: "1.5px solid var(--border)", background: "none", color: "var(--ink-soft)", fontWeight: 600, fontSize: 13, padding: "13px 0", borderRadius: 9 }} onClick={() => openSheet(g.id, "withdraw")}>Снять</button>
              )}
            </div>
          </div>
        );
      })}

      <button type="button" className="btn-ghost" onClick={openCreateForm}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        Добавить новую цель
      </button>

      {formOpen && (
        <BottomSheet onClose={closeForm}>
          <h2 className="serif">{isEditing ? "Редактировать цель" : "Новая цель"}</h2>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Название</label>
            <input type="text" className="field" placeholder="Например, отпуск в Грузии" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Сумма цели</label>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 14px" }}>
              <input type="text" inputMode="numeric" placeholder="0" className="serif" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} style={{ flex: 1, border: "none", outline: "none", fontSize: 22, fontWeight: 600, background: "none", minWidth: 0 }} />
              <span className="serif" style={{ fontSize: 17, color: "var(--ink-faint)" }}>₽</span>
            </div>
          </div>
          {!isEditing && (
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Чья цель</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={`choice-btn${goalType === "SHARED" ? " active-forest" : ""}`} onClick={() => setGoalType("SHARED")}>Общая</button>
                <button type="button" className={`choice-btn${goalType === "PERSONAL" ? " active-partner" : ""}`} onClick={() => setGoalType("PERSONAL")}>Личная</button>
              </div>
            </div>
          )}
          {!isEditing && (
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Уже отложено</label>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <input type="number" inputMode="numeric" className="amt-input" style={{ flex: 1 }} value={saved} onChange={(e) => setSaved(e.target.value.replace(/\D/g, ""))} />
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>₽</span>
              </div>
            </div>
          )}
          <button type="button" className="submit-btn" disabled={!formValid} onClick={saveGoal}>{isEditing ? "Сохранить" : "Создать цель"}</button>
          <button type="button" onClick={closeForm} style={{ width: "100%", marginTop: 8, border: "none", borderRadius: 11, padding: "13px 0", fontSize: 13.5, fontWeight: 700, color: "var(--ink-soft)", background: "var(--ivory)" }}>Отмена</button>
        </BottomSheet>
      )}

      {sheetGoal && (() => {
        const isWithdraw = sheetMode === "withdraw";
        const currentAmount = sheetGoal.currentAmount.amount;
        const enteredK = roublesToKopecks(parseInt(topupAmount, 10) || 0);
        const exceedsCurrent = isWithdraw && enteredK > currentAmount;
        const quickAmounts = isWithdraw ? [5000, 10000, 25000].filter((rub) => rub * 100 <= currentAmount) : [5000, 10000, 25000];
        const submit = isWithdraw ? withdraw : topup;
        return (
          <BottomSheet onClose={closeSheet}>
            <h2 className="serif" style={{ marginBottom: 4 }}>{isWithdraw ? "Снять с" : "Пополнить"} «{sheetGoal.name}»</h2>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--ink-soft)" }}>
              {isWithdraw ? `Доступно к снятию ${formatMoney(currentAmount)} ₽` : `Осталось ${formatMoney(Math.max(0, sheetGoal.targetAmount.amount - currentAmount))} ₽ до цели`}
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {quickAmounts.map((rub) => (
                <button key={rub} type="button" onClick={() => setTopupAmount(String(rub))} style={{ flex: 1, border: "1.5px solid var(--border)", background: "var(--ivory)", color: "var(--ink)", borderRadius: 10, padding: "14px 0", fontSize: 13, fontWeight: 600 }}>
                  {isWithdraw ? "" : "+"}{rub.toLocaleString("ru-RU")}
                </button>
              ))}
              {isWithdraw && currentAmount > 0 && (
                <button type="button" onClick={() => setTopupAmount(String(Math.round(currentAmount / 100)))} style={{ flex: 1, border: "1.5px solid var(--border)", background: "var(--ivory)", color: "var(--ink)", borderRadius: 10, padding: "14px 0", fontSize: 13, fontWeight: 600 }}>
                  Всё
                </button>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label className="field-label">Своя сумма</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${exceedsCurrent ? "var(--partner)" : "var(--border)"}`, borderRadius: 10, padding: "6px 14px" }}>
                <input type="text" inputMode="numeric" placeholder="0" className="serif" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value.replace(/\D/g, ""))} style={{ flex: 1, border: "none", outline: "none", fontSize: 20, fontWeight: 600, background: "none", minWidth: 0 }} />
                <span className="serif" style={{ fontSize: 16, color: "var(--ink-faint)" }}>₽</span>
              </div>
            </div>
            {exceedsCurrent && <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--partner)" }}>Нельзя снять больше, чем отложено в цели</p>}
            <button type="button" className="submit-btn" disabled={!topupAmount || exceedsCurrent} onClick={() => submit(enteredK)} style={{ marginTop: 8 }}>{isWithdraw ? "Снять" : "Пополнить"}</button>
            <button type="button" onClick={closeSheet} style={{ width: "100%", marginTop: 8, border: "none", borderRadius: 11, padding: "13px 0", fontSize: 13.5, fontWeight: 700, color: "var(--ink-soft)", background: "var(--ivory)" }}>Закрыть</button>
          </BottomSheet>
        );
      })()}
    </div>
  );
}
