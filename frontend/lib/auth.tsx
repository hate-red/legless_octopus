"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  apiFetch,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<User>("/auth/me", { token })
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        clearStoredToken();
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredToken();
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener("alfa:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("alfa:unauthorized", handleUnauthorized);
    };
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        token: null,
        body: { email, password },
      });
      queryClient.clear();
      setStoredToken(response.access_token);
      setUser(response.user);
      return response.user;
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const currentUser = await apiFetch<User>("/auth/me");
    setUser(currentUser);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  return context;
}
