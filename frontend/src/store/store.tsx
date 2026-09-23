import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CombinedError } from "urql";
import { isUnauthenticated } from "../graphql/client";
import { SESSION_EXPIRED_EVENT, clearSession, readSession, saveSession } from "../graphql/session";
import {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useRegisterMutation,
} from "../graphql/operations/auth.generated";
import { useGroupQuery, useGroupsQuery } from "../graphql/operations/groups.generated";
import type { GroupRole } from "../graphql/operations/groups.generated";

const ACTIVE_GROUP_KEY = "vdvoem.activeGroupId";
const INSTALL_DISMISSED_KEY = "vdvoem.installDismissed";

export interface CurrentUser {
  id: string;
  username: string;
}

export interface ActiveGroupMember {
  userId: string;
  username: string;
  role: GroupRole | null;
  self: boolean;
}

export interface ActiveGroup {
  id: string;
  name: string;
  members: ActiveGroupMember[];
}

export interface GroupListItem {
  id: string;
  name: string;
  membersCount: number;
}

/** Extracts a message safe to show a user from a failed GraphQL operation. */
export function authErrorMessage(error: CombinedError): string {
  return error.graphQLErrors[0]?.message ?? "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

interface AppStoreContextValue {
  currentUser: CurrentUser | null;
  authLoading: boolean;
  login(username: string, password: string): Promise<string | null>;
  register(username: string, password: string): Promise<string | null>;
  logout(): void;

  groups: GroupListItem[];
  groupsFetching: boolean;
  refetchGroups(): void;

  activeGroupId: string | null;
  setActiveGroupId(groupId: string | null): void;
  activeGroup: ActiveGroup | null;
  activeGroupFetching: boolean;
  refetchActiveGroup(): void;

  installDismissed: boolean;
  dismissInstall(): void;
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

export function AppStoreProvider({ children, onLogout }: { children: ReactNode; onLogout(): void }) {
  const [token, setToken] = useState<string | null>(() => readSession()?.accessToken ?? null);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(() => localStorage.getItem(ACTIVE_GROUP_KEY));
  const [installDismissed, setInstallDismissed] = useState<boolean>(() => localStorage.getItem(INSTALL_DISMISSED_KEY) === "1");

  const [meResult] = useMeQuery({ pause: !token });
  const [, loginMutation] = useLoginMutation();
  const [, registerMutation] = useRegisterMutation();
  const [, logoutMutation] = useLogoutMutation();

  const [groupsResult, reexecuteGroups] = useGroupsQuery({
    pause: !token,
    context: useMemo(() => ({ additionalTypenames: ["Group"] }), []),
  });
  const [groupResult, reexecuteGroup] = useGroupQuery({
    variables: { groupId: activeGroupId ?? "" },
    pause: !token || !activeGroupId,
  });

  // The urql auth exchange refreshes expired access tokens on its own; `me` still failing
  // as UNAUTHENTICATED means the session couldn't be renewed — drop it so AuthScreen shows.
  // Other errors (e.g. offline) keep the session.
  useEffect(() => {
    if (token && meResult.error && !meResult.fetching && isUnauthenticated(meResult.error)) {
      setToken(null);
      clearSession();
    }
  }, [token, meResult.error, meResult.fetching]);

  // The auth exchange fires this when the refresh token itself is rejected.
  useEffect(() => {
    const onExpired = () => setToken(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  function setActiveGroupId(groupId: string | null) {
    setActiveGroupIdState(groupId);
    if (groupId) localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
    else localStorage.removeItem(ACTIVE_GROUP_KEY);
  }

  // Auto-select a group once the list loads if nothing (or a since-removed group) is active.
  useEffect(() => {
    if (!groupsResult.data) return;
    const groups = groupsResult.data.groups;
    if (activeGroupId && groups.some((g) => g.id === activeGroupId)) return;
    setActiveGroupId(groups[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsResult.data]);

  async function login(username: string, password: string): Promise<string | null> {
    const result = await loginMutation({ input: { username, password } });
    if (result.error) return authErrorMessage(result.error);
    saveSession(result.data!.login);
    setToken(result.data!.login.accessToken);
    return null;
  }

  async function register(username: string, password: string): Promise<string | null> {
    const result = await registerMutation({ input: { username, password } });
    if (result.error) return authErrorMessage(result.error);
    saveSession(result.data!.register);
    setToken(result.data!.register.accessToken);
    return null;
  }

  function logout() {
    // Revoke the refresh token server-side; fire-and-forget, the local session is gone either way.
    const refreshToken = readSession()?.refreshToken;
    if (refreshToken) void logoutMutation({ refreshToken });
    setToken(null);
    clearSession();
    setActiveGroupId(null);
    onLogout();
  }

  function dismissInstall() {
    setInstallDismissed(true);
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  }

  // A paused query keeps its last data, so without the token check `me` would outlive logout.
  const currentUser: CurrentUser | null = token ? meResult.data?.me ?? null : null;

  const activeGroup: ActiveGroup | null = useMemo(() => {
    const g = groupResult.data?.group;
    if (!g) return null;
    return {
      id: g.id,
      name: g.name,
      members: g.members.map((m) => ({
        userId: m.user.id,
        username: m.user.username,
        role: m.role,
        self: m.user.id === currentUser?.id,
      })),
    };
  }, [groupResult.data, currentUser?.id]);

  const value = useMemo<AppStoreContextValue>(
    () => ({
      currentUser,
      authLoading: !!token && meResult.fetching,
      login,
      register,
      logout,
      groups: groupsResult.data?.groups ?? [],
      groupsFetching: groupsResult.fetching,
      refetchGroups: () => reexecuteGroups({ requestPolicy: "network-only" }),
      activeGroupId,
      setActiveGroupId,
      activeGroup,
      activeGroupFetching: groupResult.fetching,
      refetchActiveGroup: () => reexecuteGroup({ requestPolicy: "network-only" }),
      installDismissed,
      dismissInstall,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, token, meResult.fetching, groupsResult, activeGroupId, activeGroup, groupResult.fetching, installDismissed],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreContextValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
