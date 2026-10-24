"use client";
import { create } from "zustand";
import { api, jsonBody } from "@/shared/api/client";
import type { User } from "@/shared/api/contracts";

interface SessionState {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous";
  bootstrap: () => Promise<void>;
  login: (credentials: {
    email?: string;
    inn?: string;
    password: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  expire: () => void;
}
let bootstrapPromise: Promise<void> | null = null;
let sessionVersion = 0;
export const useSession = create<SessionState>((set) => ({
  user: null,
  status: "loading",
  bootstrap: () => {
    if (bootstrapPromise) return bootstrapPromise;
    const version = sessionVersion;
    bootstrapPromise = api<User>("/auth/me")
      .then((user) => {
        if (version === sessionVersion) set({ user, status: "authenticated" });
      })
      .catch(() => {
        if (version === sessionVersion)
          set({ user: null, status: "anonymous" });
      })
      .finally(() => {
        bootstrapPromise = null;
      });
    return bootstrapPromise;
  },
  login: async (credentials) => {
    const version = ++sessionVersion;
    const result = await api<{ user: User }>("/auth/login", {
      method: "POST",
      body: jsonBody(credentials),
    });
    if (version === sessionVersion)
      set({ user: result.user, status: "authenticated" });
    return result.user;
  },
  logout: async () => {
    ++sessionVersion;
    await api("/auth/logout", { method: "POST" });
    set({ user: null, status: "anonymous" });
  },
  setUser: (user) => {
    ++sessionVersion;
    set({ user, status: "authenticated" });
  },
  expire: () => {
    ++sessionVersion;
    set({ user: null, status: "anonymous" });
  },
}));
