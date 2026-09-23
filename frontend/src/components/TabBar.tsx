import type { Screen } from "../types";

const TABS: { id: Screen; label: string; paths: [string, string] }[] = [
  { id: "main", label: "Обзор", paths: ["M3 11l9-7 9 7", "M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"] },
  { id: "tx", label: "Операции", paths: ["M8 6h13M8 12h13M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"] },
  { id: "stats", label: "Статистика", paths: ["M4 20h16", "M7 16v-5M12 16V6M17 16v-8"] },
  { id: "budget", label: "Бюджет", paths: ["M12 12m-8.2 0a8.2 8.2 0 1 0 16.4 0a8.2 8.2 0 1 0 -16.4 0", "M12 12m-4.6 0a4.6 4.6 0 1 0 9.2 0a4.6 4.6 0 1 0 -9.2 0"] },
  { id: "goals", label: "Цели", paths: ["M5 3v18", "M5 4c2-1.3 4-1.3 6 0s4 1.3 6 0v8c-2 1.3-4 1.3-6 0s-4-1.3-6 0V4z"] },
];

export function TabBar({ active, onChange }: { active: Screen; onChange: (screen: Screen) => void }) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-item${active === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d={tab.paths[0]} />
            <path d={tab.paths[1]} />
          </svg>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
