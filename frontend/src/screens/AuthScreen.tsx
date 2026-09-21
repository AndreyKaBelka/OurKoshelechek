import { useState, type FormEvent } from "react";
import { useAppStore } from "../store/store";

export function AuthScreen() {
  const { login, register } = useAppStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!u) {
      setError("Введите имя пользователя");
      return;
    }
    if (password.length < 4) {
      setError("Пароль должен быть не короче 4 символов");
      return;
    }
    setError("");
    setSubmitting(true);
    const failure = mode === "login" ? await login(u, password) : await register(u, password);
    setSubmitting(false);
    if (failure) setError(failure);
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--forest)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAF8F1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12a8 8 0 1 1-3-6.2" />
            <path d="M20 5v5h-5" />
          </svg>
        </div>
        <span className="serif" style={{ fontSize: 20, fontWeight: 600 }}>Вдвоём</span>
      </div>
      <p style={{ textAlign: "center", margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Общий бюджет для двоих</p>

      <form className="card" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="serif card-title" style={{ margin: 0 }}>{mode === "login" ? "Вход" : "Регистрация"}</h2>
        <div>
          <label className="field-label">Имя пользователя</label>
          <input className="field" autoCapitalize="none" autoCorrect="off" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Пароль</label>
          <input className="field" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>

      <div className="auth-switch">
        {mode === "login" ? (
          <>Нет аккаунта? <button type="button" onClick={() => { setMode("register"); setError(""); }}>Зарегистрироваться</button></>
        ) : (
          <>Уже есть аккаунт? <button type="button" onClick={() => { setMode("login"); setError(""); }}>Войти</button></>
        )}
      </div>
    </div>
  );
}
