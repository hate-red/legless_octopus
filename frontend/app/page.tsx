"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "bank") {
      router.replace("/bank/applications");
    } else {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <PageLoader label="Открываем кабинет" />
    </div>
  );
}
