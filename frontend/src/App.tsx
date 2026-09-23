import { useState } from "react";
import { useAppStore } from "./store/store";
import type { Screen } from "./types";
import { TabBar } from "./components/TabBar";
import { InstallBanner } from "./components/InstallBanner";
import { AuthScreen } from "./screens/AuthScreen";
import { OverviewScreen } from "./screens/OverviewScreen";
import { TransactionsScreen } from "./screens/TransactionsScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { BudgetScreen } from "./screens/BudgetScreen";
import { GoalsScreen } from "./screens/GoalsScreen";
import { GroupScreen } from "./screens/GroupScreen";

function AppShell() {
  const { activeGroup, installDismissed, dismissInstall } = useAppStore();
  const [screen, setScreen] = useState<Screen>("main");
  const effectiveScreen: Screen = activeGroup ? screen : "group";

  function navigate(next: Screen) {
    window.scrollTo(0, 0);
    setScreen(next);
  }

  return (
    <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--ivory)", position: "relative" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "calc(env(safe-area-inset-top) + 18px) 16px calc(env(safe-area-inset-bottom) + 108px)" }}>
        {!installDismissed && <InstallBanner onDismiss={dismissInstall} />}

        {effectiveScreen === "main" && <OverviewScreen onNavigate={navigate} />}
        {effectiveScreen === "tx" && <TransactionsScreen />}
        {effectiveScreen === "stats" && <StatsScreen />}
        {effectiveScreen === "budget" && <BudgetScreen onNavigate={navigate} />}
        {effectiveScreen === "goals" && <GoalsScreen />}
        {effectiveScreen === "group" && <GroupScreen onNavigate={navigate} />}
      </div>

      {effectiveScreen === "main" && (
        <button type="button" className="fab" aria-label="Добавить операцию" onClick={() => navigate("tx")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      )}

      {activeGroup && <TabBar active={effectiveScreen} onChange={navigate} />}
    </div>
  );
}

export function App() {
  const { currentUser, authLoading } = useAppStore();
  if (authLoading) return null;
  if (!currentUser) return <AuthScreen />;
  return <AppShell />;
}
