"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";

import { Brand } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, Button, Card, PageLoader } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().min(1, "Введите email").email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  {
    email: "client1@example.com",
    label: "ООО «Ромашка»",
    note: "IT · автоодобрение",
    role: "Клиент",
    icon: Building2,
    tone: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50",
  },
  {
    email: "client2@example.com",
    label: "ИП Иванов",
    note: "Торговля · встречное предложение",
    role: "Клиент",
    icon: Store,
    tone: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50",
  },
  {
    email: "client3@example.com",
    label: "ООО «Риск»",
    note: "Просрочки · отказ",
    role: "Клиент",
    icon: Building2,
    tone: "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/50",
  },
  {
    email: "bank@example.com",
    label: "Кабинет банка",
    note: "Ручная проверка заявок",
    role: "Банк",
    icon: ShieldCheck,
    tone: "text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/50",
  },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === "bank" ? "/bank/applications" : "/dashboard");
    }
  }, [loading, router, user]);

  const performLogin = async (email: string, password: string) => {
    setServerError(null);
    const currentUser = await login(email, password);
    router.replace(
      currentUser.role === "bank" ? "/bank/applications" : "/dashboard",
    );
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await performLogin(values.email, values.password);
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Не удалось войти. Попробуйте ещё раз.",
      );
    }
  };

  const handleDemo = async (email: string) => {
    setDemoLoading(email);
    try {
      await performLogin(email, "password123");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Не удалось войти в демо-аккаунт.",
      );
      setDemoLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader label="Проверяем сессию" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-app flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-2">
          <Brand href="/login" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              Демо-версия
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        <main className="grid flex-1 items-stretch gap-5 py-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="radial-alfa hero-noise relative hidden overflow-hidden rounded-2xl p-8 text-white lg:flex lg:flex-col xl:p-12">
            <div className="absolute -right-24 top-10 h-64 w-64 rounded-full border border-white/10" />
            <div className="absolute -right-10 top-24 h-40 w-40 rounded-full border border-white/10" />
            <div className="absolute bottom-20 left-10 h-2 w-2 rounded-full bg-alfa-400" />

            <div className="relative inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 backdrop-blur">
              <Sparkles className="h-4 w-4 text-alfa-300" />
              Решение за минуты, а не за дни
            </div>

            <div className="relative my-auto max-w-xl py-12">
              <h1 className="text-4xl font-semibold leading-[1.06] tracking-tight xl:text-6xl">
                Кредит для бизнеса
                <br />
                <span className="text-alfa-300">без лишних шагов.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/60">
                Заполните одну заявку — банк сам соберёт данные из ЕГРЮЛ,
                ГИР БО и БКИ, проверит цель и рассчитает комфортную нагрузку.
              </p>

              <div className="mt-9 space-y-4">
                {[
                  "Все проверки — в одном окне",
                  "Прозрачный скоринг и понятная причина решения",
                  "Локальный ИИ: данные не уходят внешним сервисам",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-base text-white/75"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-alfa-300" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
                {[
                  { value: "3 мин", label: "на заявку" },
                  { value: "100%", label: "онлайн" },
                  { value: "24/7", label: "доступ" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur"
                  >
                    <div className="text-2xl font-semibold">{item.value}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-center gap-2 text-xs text-white/35">
              <Cpu className="h-4 w-4" />
              sentence-transformers · локальная семантическая модель
            </div>
          </section>

          <section className="flex items-center justify-center py-4 lg:py-0">
            <div className="w-full max-w-[520px] animate-fade-up">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <span className="h-px w-6 bg-primary" />
                Вход в кабинет
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                С возвращением
              </h2>
              <p className="mt-2 text-base text-muted-foreground">
                Войдите, чтобы продолжить работу с заявками.
              </p>

              <Card className="mt-6 p-6 sm:p-8">
                {serverError ? (
                  <Alert tone="danger" className="mb-5">
                    {serverError}
                  </Alert>
                ) : null}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@company.ru"
                        className={cn(
                          "pl-12",
                          errors.email && "border-destructive",
                        )}
                        {...register("email")}
                      />
                    </div>
                    {errors.email ? (
                      <p className="text-sm text-destructive">
                        {errors.email.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className={cn(
                          "px-12",
                          errors.password && "border-destructive",
                        )}
                        {...register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={
                          showPassword ? "Скрыть пароль" : "Показать пароль"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="text-sm text-destructive">
                        {errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    loading={isSubmitting}
                    className="w-full"
                  >
                    Войти
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>

                <p className="mt-5 text-center text-sm text-muted-foreground">
                  Доступ к кабинету предоставляется банком.
                </p>
              </Card>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Демо-аккаунты
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((account) => {
                  const Icon = account.icon;
                  const busy = demoLoading === account.email;
                  return (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => handleDemo(account.email)}
                      disabled={demoLoading !== null}
                      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3.5 text-left transition hover:border-ring/40 hover:bg-muted/40 disabled:opacity-60"
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          account.tone,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {account.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                          {busy ? "Выполняется вход…" : account.note}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                Пароль для всех демо-аккаунтов:{" "}
                <span className="font-mono font-medium text-foreground">
                  password123
                </span>
              </p>
            </div>
          </section>
        </main>

        <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          Демонстрационный проект · данные не используются для реального
          кредитования
        </footer>
      </div>
    </div>
  );
}
