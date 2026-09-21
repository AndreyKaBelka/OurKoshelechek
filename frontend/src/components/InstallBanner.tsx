export function InstallBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="install-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F4237" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
        <path d="M12 16V4" />
        <path d="M8 8l4-4 4 4" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      <div style={{ flex: 1, fontSize: 12, lineHeight: 1.45, color: "var(--forest-dark)" }}>
        <b style={{ fontSize: 12.5 }}>Установите на экран «Домой»</b>
        <br />В Safari нажмите «Поделиться», затем «На экран „Домой“» — приложение откроется во весь экран, без адресной строки.
      </div>
      <button type="button" onClick={onDismiss} aria-label="Скрыть подсказку" style={{ border: "none", background: "none", padding: 2, color: "var(--forest-dark)", display: "flex", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
