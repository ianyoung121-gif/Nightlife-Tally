import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export const AUTH_TOKEN_KEY = "weekender_auth_session";
const ISSUER_URL = process.env.EXPO_PUBLIC_ISSUER_URL ?? "https://replit.com/oidc";

export async function getStoredAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(AUTH_TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

async function storeAuthToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

async function clearStoredAuthToken(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

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
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function apiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "")
  );
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
      const token = await getStoredAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      const result = await fetch(`${apiBaseUrl()}/api/auth/user`, { headers: { Authorization: `Bearer ${token}` } });
      const data = result.ok ? await result.json() as { user: AuthUser | null } : { user: null };
      if (!data.user) await clearStoredAuthToken();
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
        await storeAuthToken(data.token);
        setIsLoading(true);
        await fetchUser();
      } catch {
        setIsLoading(false);
      }
    })();
  }, [fetchUser, redirectUri, request, response]);

  const login = useCallback(async () => { await promptAsync(); }, [promptAsync]);
  const logout = useCallback(async () => {
    const token = await getStoredAuthToken();
    try {
      if (token) await fetch(`${apiBaseUrl()}/api/mobile-auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } finally {
      await clearStoredAuthToken();
      setUser(null);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    const token = await getStoredAuthToken();
    if (!token) return;

    const result = await fetch(`${apiBaseUrl()}/api/auth/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!result.ok) throw new Error("Account deletion failed");

    await clearStoredAuthToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, isAuthenticated: Boolean(user), login, logout, deleteAccount }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}