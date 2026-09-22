import {useState} from "react";
import {authErrorMessage, useAppStore} from "../store/store";
import {formatMoney, kopecksToRoubleInput, roublesToKopecks} from "../lib/money";
import {categoryIcon, TwoPathIcon} from "../lib/icons";
import {currentPeriod} from "../lib/period";
import {Avatar} from "../components/Avatar";
import {useBudgetQuery} from "../graphql/operations/budget.generated";
import {
    useCategoriesQuery,
    useCreateCategoryMutation,
    useDeleteCategoryMutation,
    useUpdateCategoryMutation,
} from "../graphql/operations/categories.generated";
import {useSummaryQuery} from "../graphql/operations/summary.generated";
import type {Screen} from "../types";

const budgetContext = {additionalTypenames: ["Category"]};
const categoriesContext = {additionalTypenames: ["Category"]};
const summaryContext = {additionalTypenames: ["Transaction", "GoalContribution"]};

export function BudgetScreen({onNavigate}: { onNavigate: (screen: Screen) => void }) {
    const {activeGroup} = useAppStore();
    const groupId = activeGroup?.id ?? "";
    const period = currentPeriod();

    const [budgetResult] = useBudgetQuery({variables: {groupId, period}, pause: !groupId, context: budgetContext});
    const [categoriesResult] = useCategoriesQuery({variables: {groupId}, pause: !groupId, context: categoriesContext});
    const [summaryResult] = useSummaryQuery({variables: {groupId, period}, pause: !groupId, context: summaryContext});
    const [, createCategory] = useCreateCategoryMutation();
    const [, updateCategory] = useUpdateCategoryMutation();
    const [, deleteCategory] = useDeleteCategoryMutation();

    const [error, setError] = useState("");
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [categoryName, setCategoryName] = useState("");
    const [categoryIconValue, setCategoryIconValue] = useState("📦");
    const [categoryLimit, setCategoryLimit] = useState("");
    const [categorySaving, setCategorySaving] = useState(false);

    if (!activeGroup) return null;

    const income = budgetResult.data?.budget.income.amount ?? 0;
    const allocated = budgetResult.data?.budget.totalAllocated.amount ?? 0;
    const free = budgetResult.data?.budget.free.amount ?? 0;
    const categories = categoriesResult.data?.categories ?? [];
    const spentByCategory = new Map((summaryResult.data?.summary.expense.byCategory ?? []).map((c) => [c.categoryId, c.amount.amount]));
    const incomeByMember = new Map((summaryResult.data?.summary.income.byMember ?? []).map((m) => [m.userId, m.amount.amount]));

    async function addCategory() {
        const name = categoryName.trim();

        if (!name) return;

        setCategorySaving(true);
        setError("");

        const limitValue = Number(
            categoryLimit.replace(",", ".").trim()
        );

        const monthlyLimit =
            Number.isFinite(limitValue) && limitValue > 0
                ? {
                    amount: Math.round(limitValue * 100),
                }
                : null;

        const result = await createCategory({
            groupId: activeGroup!.id,
            input: {
                name,
                icon: categoryIconValue,
                monthlyLimit,
            },
        });

        setCategorySaving(false);

        if (result.error) {
            setError(authErrorMessage(result.error));
            return;
        }

        setCategoryName("");
        setCategoryIconValue("📦");
        setCategoryLimit("");
        setShowCategoryForm(false);
    }

    async function setLimit(categoryId: string, limitK: number) {
        const result = await updateCategory({
            groupId: activeGroup!.id,
            categoryId,
            input: {monthlyLimit: {amount: limitK}}
        });
        if (result.error) setError(authErrorMessage(result.error));
    }

    async function removeCategory(categoryId: string, categoryName: string) {
        if (!window.confirm(`Удалить категорию «${categoryName}»? Операции в ней останутся в истории, но будут без категории.`)) return;
        const result = await deleteCategory({groupId: activeGroup!.id, categoryId});
        if (result.error) setError(authErrorMessage(result.error));
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="serif">Бюджет</h1>
                <p>Доходы участников и лимиты по категориям на месяц</p>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <div className="card">
                <h2 className="serif card-title">Доходы по участникам</h2>
                <p className="card-subtitle">Считается автоматически по операциям «Доход» за месяц</p>
                {activeGroup.members.map((m, i) => (
                    <div key={m.userId} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        borderTop: i > 0 ? "1px solid var(--border)" : undefined
                    }}>
                        <div style={{display: "flex", alignItems: "center", gap: 10}}>
                            <Avatar label={m.self ? "Вы" : m.username.slice(0, 1).toUpperCase()} self={m.self}/>
                            <span style={{
                                fontSize: 13.5,
                                fontWeight: 600
                            }}>{m.self ? "Вы" : m.username}</span>
                        </div>
                        <span style={{fontSize: 13.5, fontWeight: 600}}>{formatMoney(incomeByMember.get(m.userId) ?? 0)} ₽</span>
                    </div>
                ))}
            </div>

            <div className="stat-row">
                <div className="stat-tile">
                    <span className="stat-tile-label">Доход</span>
                    <div className="stat-tile-value">{formatMoney(income)} ₽</div>
                </div>
                <div className="stat-tile">
                    <span className="stat-tile-label">Распределено</span>
                    <div className="stat-tile-value">{formatMoney(allocated)} ₽</div>
                </div>
                <div className="stat-tile">
                    <span className="stat-tile-label">Свободно</span>
                    <div className="stat-tile-value"
                         style={{color: free < 0 ? "var(--rust)" : "var(--ink)"}}>{formatMoney(free)} ₽
                    </div>
                </div>
            </div>

            <div className="card card-tight">
                {categories.map((c, i) => {
                    const spent = spentByCategory.get(c.id) ?? 0;
                    const limit = c.monthlyLimit?.amount ?? 0;
                    const over = spent > limit;
                    const near = !over && limit > 0 && spent / limit >= 0.85;
                    const pct = limit ? Math.round((spent / limit) * 100) : 0;
                    return (
                        <div key={c.id} style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            padding: "12px 0 4px",
                            borderTop: i > 0 ? "1px solid var(--border)" : undefined
                        }}>
                            <div style={{display: "flex", alignItems: "center", gap: 10}}>
                                <div className="tx-icon"><TwoPathIcon paths={categoryIcon(c.name)} size={14}/></div>
                                <span style={{flex: 1, fontSize: 14, fontWeight: 600}}>{c.name}</span>
                                <button type="button" className="row-trash" aria-label="Удалить категорию"
                                        onClick={() => removeCategory(c.id, c.name)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18"/>
                                        <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>
                                    </svg>
                                </button>
                            </div>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "4px 0 8px 40px"
                            }}>
                                <span style={{fontSize: 11.5, color: "var(--ink-soft)"}}>{pct}% использовано</span>
                                <div style={{display: "flex", alignItems: "center", gap: 5}}>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        className="amt-input"
                                        defaultValue={kopecksToRoubleInput(limit)}
                                        key={`${c.id}-${limit}`}
                                        onBlur={(e) => setLimit(c.id, roublesToKopecks(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
                                    />
                                    <span style={{fontSize: 12, color: "var(--ink-soft)"}}>₽</span>
                                </div>
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 6, padding: "0 0 12px 40px"}}>
                                <div style={{display: "flex", justifyContent: "space-between", fontSize: 12.5}}>
                                    <span style={{color: "var(--ink-soft)"}}>Потрачено</span>
                                    <span style={{
                                        color: over ? "var(--rust)" : "var(--ink-soft)",
                                        fontWeight: 600
                                    }}>{formatMoney(spent)} / {formatMoney(limit)} ₽</span>
                                </div>
                                <div className="progress-track">
                                    <div className="progress-fill" style={{
                                        background: over ? "var(--rust)" : near ? "var(--gold)" : "var(--forest)",
                                        width: `${Math.min(100, limit ? Math.round((spent / limit) * 100) : 0)}%`
                                    }}/>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!showCategoryForm ? (
                <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                        setError("");
                        setShowCategoryForm(true);
                    }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 5v14M5 12h14"/>
                    </svg>

                    Добавить категорию
                </button>
            ) : (
                <div className="card">
                    <h2 className="serif card-title">
                        Новая категория
                    </h2>

                    <p className="card-subtitle">
                        Создайте категорию и установите месячный лимит
                    </p>

                    <label className="field-label">
                        Название
                    </label>

                    <input
                        type="text"
                        className="field"
                        placeholder="Например, Продукты"
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        autoFocus
                    />

                    <label
                        className="field-label"
                        style={{marginTop: 14}}
                    >
                        Иконка
                    </label>

                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 6,
                        }}
                    >
                        {[
                            "📦",
                            "🍎",
                            "🏠",
                            "🚗",
                            "🎮",
                            "✈️",
                            "💊",
                            "👕",
                            "🍽️",
                            "🎁",
                        ].map((icon) => (
                            <button
                                key={icon}
                                type="button"
                                onClick={() => setCategoryIconValue(icon)}
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 10,
                                    border:
                                        categoryIconValue === icon
                                            ? "2px solid var(--forest)"
                                            : "1px solid var(--border)",
                                    background:
                                        categoryIconValue === icon
                                            ? "var(--forest-light)"
                                            : "var(--ivory)",
                                    fontSize: 20,
                                    cursor: "pointer",
                                }}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>

                    <label
                        className="field-label"
                        style={{marginTop: 14}}
                    >
                        Месячный лимит
                    </label>

                    <div
                        style={{
                            position: "relative",
                        }}
                    >
                        <input
                            type="text"
                            inputMode="decimal"
                            className="field"
                            placeholder="Например, 15000"
                            value={categoryLimit}
                            onChange={(e) => setCategoryLimit(e.target.value)}
                        />

                        <span
                            style={{
                                position: "absolute",
                                right: 14,
                                top: "50%",
                                transform: "translateY(-50%)",
                                color: "var(--muted)",
                                pointerEvents: "none",
                            }}
                        >
        ₽
      </span>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 18,
                        }}
                    >
                        <button
                            type="button"
                            className="submit-btn"
                            disabled={!categoryName.trim() || categorySaving}
                            onClick={addCategory}
                        >
                            {categorySaving ? "Создание..." : "Создать"}
                        </button>

                        <button
                            type="button"
                            className="btn-ghost"
                            disabled={categorySaving}
                            onClick={() => {
                                setShowCategoryForm(false);
                                setCategoryName("");
                                setCategoryIconValue("📦");
                                setCategoryLimit("");
                            }}
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            )}

            <button type="button" className="link-btn" style={{textAlign: "center", padding: "8px 0"}}
                    onClick={() => onNavigate("goals")}>Управлять целями накоплений →
            </button>
        </div>
    );
}
