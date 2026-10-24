"use client";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/entities/session/model/store";
import { useCabinet } from "@/entities/cabinet/model/store";
import { usePreferences } from "@/shared/model/preferences";

export function Providers({ children }: { children: ReactNode }) {
  const theme = usePreferences((state) => state.theme);
  useEffect(() => {
    void usePreferences.persist.rehydrate();
    void useSession.getState().bootstrap();
    const expire = () => {
      useSession.getState().expire();
      useCabinet.getState().reset();
    };
    window.addEventListener("cabinet:unauthorized", expire);
    return () => window.removeEventListener("cabinet:unauthorized", expire);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return children;
}
