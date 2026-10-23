"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowLeft,
  Building2,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { PageLoader } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export function RequireAuth({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== role) {
      router.replace(user.role === "bank" ? "/bank/applications" : "/dashboard");
    }
  }, [loading, role, router, user]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader label="Проверяем доступ" />
      </div>
    );
  }

  return <>{children}</>;
}

export function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground shadow-sm transition group-hover:bg-primary/90">
        А
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-foreground" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold leading-5 text-foreground">
          Альфа-Кредит
        </div>
        <div className="truncate text-xs leading-5 text-muted-foreground">
          Кабинет малого бизнеса
        </div>
      </div>
    </Link>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center gap-3 rounded-lg px-3.5 text-[15px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;
  const isBank = user.role === "bank";
  const homeHref = isBank ? "/bank/applications" : "/dashboard";

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const navigation = isBank ? (
    <>
      <NavLink
        href="/bank/applications"
        active={pathname.startsWith("/bank/applications")}
        icon={<LayoutDashboard className="h-5 w-5" />}
      >
        Заявки бизнеса
      </NavLink>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 text-sm font-medium text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300">
        <ShieldCheck className="h-4 w-4" />
        Кабинет банка
      </div>
    </>
  ) : (
    <>
      <NavLink
        href="/dashboard"
        active={pathname === "/dashboard"}
        icon={<LayoutDashboard className="h-5 w-5" />}
      >
        Мои заявки
      </NavLink>
      <NavLink
        href="/applications/new"
        active={pathname === "/applications/new"}
        icon={<PlusCircle className="h-5 w-5" />}
      >
        Новая заявка
      </NavLink>
      <NavLink
        href="/profile"
        active={pathname === "/profile"}
        icon={<UserRound className="h-5 w-5" />}
      >
        Профиль
      </NavLink>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-app gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <aside className="no-print sticky top-6 hidden h-[calc(100vh-3rem)] w-[252px] shrink-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm lg:flex">
          <Brand href={homeHref} />

          <div className="mb-2 mt-8 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Навигация
          </div>
          <nav className="space-y-1">{navigation}</nav>

          <div className="mt-auto space-y-3 border-t border-border pt-4">
            <ThemeToggle withLabel />
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold uppercase text-primary-foreground">
                  {user.full_name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground" title={user.full_name}>
                    {user.full_name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {isBank ? (
                      "Сотрудник банка"
                    ) : (
                      <>
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {user.company?.name ?? "Профиль не заполнен"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm lg:hidden">
            <Brand href={homeHref} />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                title="Выйти"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>

          <nav className="no-print mb-5 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-sm lg:hidden [&_a]:flex-1 [&_a]:justify-center [&_a]:gap-2 [&_a]:px-2 [&_a]:text-sm">
            {navigation}
          </nav>

          <main className="min-w-0">{children}</main>

          <footer className="no-print mt-10 border-t border-border pt-5 text-xs text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                  А
                </div>
                Демо-проект хакатона Альфа-Банка · 2026
              </div>
              <div>
                Данные интеграций и ИИ-проверки являются демонстрационными.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export function ProtectedPage({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  return (
    <RequireAuth role={role}>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Link>
  );
}
