import { useState } from "react";
import { useAppStore, authErrorMessage } from "../store/store";
import { useCreateGroupMutation, useInviteMemberMutation, useRemoveMemberMutation, useUpdateGroupMutation } from "../graphql/operations/groups.generated";
import type { Screen } from "../types";

export function GroupScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { groups, activeGroupId, setActiveGroupId, activeGroup, logout, refetchGroups, refetchActiveGroup } = useAppStore();
  const [, createGroupMutation] = useCreateGroupMutation();
  const [, updateGroupMutation] = useUpdateGroupMutation();
  const [, inviteMemberMutation] = useInviteMemberMutation();
  const [, removeMemberMutation] = useRemoveMemberMutation();

  const [newGroupName, setNewGroupName] = useState("");
  const [groupName, setGroupName] = useState(activeGroup?.name ?? "");
  const [syncedGroupId, setSyncedGroupId] = useState(activeGroup?.id);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [error, setError] = useState("");

  if (activeGroup && activeGroup.id !== syncedGroupId) {
    setSyncedGroupId(activeGroup.id);
    setGroupName(activeGroup.name);
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const result = await createGroupMutation({ input: { name } });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setError("");
    setNewGroupName("");
    refetchGroups();
    if (result.data) setActiveGroupId(result.data.createGroup.id);
  }

  async function renameGroup() {
    if (!activeGroup) return;
    const name = groupName.trim();
    if (!name || name === activeGroup.name) return;
    const result = await updateGroupMutation({ groupId: activeGroup.id, input: { name } });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    setError("");
    refetchGroups();
    refetchActiveGroup();
  }

  async function invite() {
    const username = inviteUsername.trim();
    if (!username || !activeGroup) return;
    if (activeGroup.members.some((m) => m.username === username)) {
      setInviteMessage(`@${username} уже в группе`);
      setInviteUsername("");
      return;
    }
    const result = await inviteMemberMutation({ groupId: activeGroup.id, input: { username } });
    if (result.error) {
      setInviteMessage(authErrorMessage(result.error));
      return;
    }
    setInviteUsername("");
    setInviteMessage(`@${username} добавлен в группу`);
    refetchActiveGroup();
    refetchGroups();
  }

  async function removeMember(userId: string) {
    if (!activeGroup) return;
    const result = await removeMemberMutation({ groupId: activeGroup.id, userId });
    if (result.error) {
      setError(authErrorMessage(result.error));
      return;
    }
    refetchActiveGroup();
    refetchGroups();
  }

  return (
    <div className="page">
      <button type="button" onClick={() => onNavigate("main")} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", padding: 0, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", alignSelf: "flex-start" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        Обзор
      </button>

      <div className="page-header">
        <h1 className="serif">Группа</h1>
        <p>Общий бюджет и участники</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {groups.length > 1 && (
        <div className="card card-tight">
          {groups.map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGroupId(g.id)}
              style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "14px 0",
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                border: "none",
                borderTopWidth: i > 0 ? 1 : 0,
                background: "none",
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: g.id === activeGroupId ? "var(--forest-dark)" : "var(--ink)" }}>{g.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>Участников: {g.membersCount}</div>
              </div>
              {g.id === activeGroupId && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest-dark)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="serif card-title">Создать ещё одну группу</h2>
        <p className="card-subtitle">Вы станете её первым участником и владельцем</p>
        <input type="text" className="field" placeholder="Например, Наш бюджет" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} style={{ marginBottom: 12 }} />
        <button type="button" className="submit-btn" disabled={!newGroupName.trim()} onClick={createGroup}>Создать группу</button>
      </div>

      {activeGroup && (
        <>
          <div className="card">
            <label className="field-label" style={{ fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Название группы</label>
            <input
              type="text"
              className="field"
              style={{ fontSize: 14, fontWeight: 600 }}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onBlur={renameGroup}
            />
            <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--ink-faint)" }}>Участников: {activeGroup.members.length}</p>
          </div>

          <div className="card card-tight">
            {activeGroup.members.map((m, i) => (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div className={`avatar ${m.self ? "avatar-you" : "avatar-partner"}`} style={{ width: 34, height: 34, fontSize: 12 }}>{m.username.slice(0, 1).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{m.username}{m.self ? " · вы" : ""}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{m.role === "OWNER" ? "Владелец группы" : "Участник"}</div>
                </div>
                {!m.self && (
                  <button type="button" className="row-trash" aria-label="Удалить участника" onClick={() => removeMember(m.userId)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="serif card-title">Пригласить участника</h2>
            <p className="card-subtitle">По username — он сразу окажется в группе</p>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 10, padding: "0 12px", minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-faint)" }}>@</span>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="username"
                  value={inviteUsername}
                  onChange={(e) => { setInviteUsername(e.target.value.replace(/[^\p{L}\p{N}_.]/gu, "")); setInviteMessage(""); }}
                  style={{ flex: 1, border: "none", outline: "none", padding: "12px 6px", fontSize: 13.5, background: "none", minWidth: 0 }}
                />
              </div>
              <button type="button" className="submit-btn" disabled={!inviteUsername.trim()} onClick={invite} style={{ width: "auto", padding: "0 18px", flexShrink: 0 }}>Добавить</button>
            </div>
            {inviteMessage && (
              <div className="toast-success">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                {inviteMessage}
              </div>
            )}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={logout}
        style={{ border: "none", background: "none", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--rust)", padding: "8px 0" }}
      >
        Выйти из аккаунта
      </button>
    </div>
  );
}
