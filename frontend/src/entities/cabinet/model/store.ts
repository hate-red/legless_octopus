"use client";
import { create } from "zustand";
import { api, errorMessage, jsonBody } from "@/shared/api/client";
import type {
  Application,
  CompanyDocument,
  Notification,
  Product,
  UserRole,
} from "./types";

interface CabinetState {
  applications: Application[];
  products: Product[];
  documents: CompanyDocument[];
  notifications: Notification[];
  loading: boolean;
  ready: boolean;
  error: string | null;
  refresh: (role: UserRole, quiet?: boolean) => Promise<void>;
  readNotifications: (ids: number[]) => Promise<void>;
  reset: () => void;
}
const initial = {
  applications: [],
  products: [],
  documents: [],
  notifications: [],
  loading: false,
  ready: false,
  error: null,
};
let requestVersion = 0;
export const useCabinet = create<CabinetState>((set) => ({
  ...initial,
  refresh: async (role, quiet = false) => {
    const version = ++requestVersion;
    if (!quiet) set({ loading: true, error: null });
    try {
      const [applications, products, documents, notifications] =
        await Promise.all([
          api<Application[]>(
            role === "bank" ? "/bank/applications" : "/applications",
          ),
          api<Product[]>("/products"),
          role === "client"
            ? api<CompanyDocument[]>("/company/documents")
            : Promise.resolve([]),
          api<Notification[]>("/notifications"),
        ]);
      if (version === requestVersion)
        set({
          applications,
          products,
          documents,
          notifications,
          loading: false,
          ready: true,
          error: null,
        });
    } catch (error) {
      if (version === requestVersion)
        set({ error: errorMessage(error), loading: false });
    }
  },
  readNotifications: async (ids) => {
    if (!ids.length) return;
    await api("/notifications/read", {
      method: "POST",
      body: jsonBody({ ids }),
    });
    set((state) => ({
      notifications: state.notifications.map((note) =>
        ids.includes(note.id) ? { ...note, read: true } : note,
      ),
    }));
  },
  reset: () => {
    ++requestVersion;
    set(initial);
  },
}));
