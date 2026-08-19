import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export const AUTH_TOKEN_KEY = "weekender_auth_session";
const ISSUER_URL = process.env.EXPO_PUBLIC_ISSUER_URL ?? "https://replit.com/oidc";

interface AuthUser {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function apiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const discovery = AuthSession.useAutoDiscovery(ISSUER_URL);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "weekender" });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_REPL_ID ?? "",
      redirectUri,
      scopes: ["openid", "email", "profile", "offline_access"],
      prompt: AuthSession.Prompt.Login,
    },
    discovery,
  );

  const fetchUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (!token) {
        setUser(null);
        return;
      }
      const result = await fetch(`${apiBaseUrl()}/api/auth/user`, { headers: { Authorization: `Bearer ${token}` } });
      const data = result.ok ? await result.json() as { user: AuthUser | null } : { user: null };
      if (!data.user) await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUser(); }, [fetchUser]);

  useEffect(() => {
    if (response?.type !== "success" || !request?.codeVerifier) return;
    const { code, state } = response.params;
    if (!code || !state) return;
    void (async () => {
      try {
        const result = await fetch(`${apiBaseUrl()}/api/mobile-auth/token-exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state, code_verifier: request.codeVerifier, redirect_uri: redirectUri, nonce: (request as { nonce?: string }).nonce }),
        });
        const data = result.ok ? await result.json() as { token?: string } : {};
        if (!data.token) throw new Error("Token exchange failed");
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
        setIsLoading(true);
        await fetchUser();
      } catch {
        setIsLoading(false);
      }
    })();
  }, [fetchUser, redirectUri, request, response]);

  const login = useCallback(async () => { await promptAsync(); }, [promptAsync]);
  const logout = useCallback(async () => {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    try {
      if (token) await fetch(`${apiBaseUrl()}/api/mobile-auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } finally {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      setUser(null);
    }
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, isAuthenticated: Boolean(user), login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}