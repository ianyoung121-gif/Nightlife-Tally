import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function basePath(): string {
  return window.location.pathname || "/";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/user", { credentials: "include" })
      .then((response) => response.ok ? response.json() as Promise<{ user: AuthUser | null }> : { user: null })
      .then((data) => {
        if (active) setUser(data.user ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const login = useCallback(() => {
    window.location.assign(`/api/login?returnTo=${encodeURIComponent(basePath())}`);
  }, []);
  const logout = useCallback(() => {
    window.location.assign(`/api/logout?returnTo=${encodeURIComponent(basePath())}`);
  }, []);

  const deleteAccount = useCallback(async () => {
    const response = await fetch("/api/auth/account", {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Account deletion failed");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: Boolean(user), login, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}