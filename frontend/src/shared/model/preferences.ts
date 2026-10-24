"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface Preferences {
  theme: "light" | "dark";
  sidebarCollapsed: boolean | null;
  toggleTheme: () => void;
  setSidebarCollapsed: (value: boolean) => void;
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: null,
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
    }),
    {
      name: "alfa-cabinet-preferences",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
