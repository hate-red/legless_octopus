"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Mail,
  Plus,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import { ProtectedPage } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  EmptyState,
  SectionCard,
  Skeleton,
  buttonClass,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatNumber,
  legalFormLabel,
  pluralYears,
  registrationNumberLabel,
} from "@/lib/format";
import type { ApplicationListItem, ApplicationStatus } from "@/lib/types";

const approvedStatuses: ApplicationStatus[] = [
  "APPROVED",
  "CONTRACT_SIGNING",
  "DISBURSED",
];

const inProgressStatuses: ApplicationStatus[] = [
  "VALIDATION",
  "ENRICHMENT",
  "AI_PURPOSE_CHECK",
  "SCORING",
  "MANUAL_REVIEW",
  "COUNTER_OFFER",
];

export default function ProfilePage() {
  return (
    <ProtectedPage role="client">
      <ProfileContent />
    </ProtectedPage>
  );
}

function ProfileContent() {
  const { user, refreshUser } = useAuth();
  const company = user?.company;

  useEffect(() => {
    refreshUser().catch(() => undefined);
  }, [refreshUser]);

  const applicationsQuery = useQuery({
    queryKey: ["applications"],
    queryFn: () => apiFetch<ApplicationListItem[]>("/applications"),
  });

  const applications = applicationsQuery.data ?? [];
  const approved = applications.filter((application) =>
    approvedStatuses.includes(application.status),
  );
  const inProgress = applications.filter((application) =>
    inProgressStatuses.includes(application.status),
  );
  const rejected = applications.filter(
    (application) => application.status === "REJECTED",
  );
  const approvedTotal = approved.reduce(
    (sum, application) =>
      sum +
      (application.approval?.approved_amount ?? application.amount),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-px w-6 bg-primary" />
            Личный кабинет
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Профиль компании
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Данные организации, которые банк использует при рассмотрении заявок.
          </p>
        </div>
        <Link
          href="/applications/new"
          className={buttonClass("primary", "md", "shrink-0")}
        >
          <Plus className="h-5 w-5" />
          Новая заявка
        </Link>
      </div>

      {!company ? (
        <Card className="p-6">
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="Компания не заполнена"
            description="В профиле пока нет данных организации. Обратитесь в банк, чтобы восстановить профиль компании."
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-zinc-950 p-6 text-white sm:p-8">
              <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10" />
              <div className="absolute -right-4 -top-8 h-36 w-36 rounded-full border border-white/10" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl font-semibold">
                    {company.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">
                        {company.name}
                      </h2>
                      <Badge
                        variant="outline"
                        className="border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      >
                        {legalFormLabel(company.legal_form)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-white/10 bg-white/5 text-white/60"
                      >
                        Клиент банка
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
                      <span>ИНН {company.inn}</span>
                      <span>
                        {registrationNumberLabel(company.legal_form)}{" "}
                        {company.ogrn || "не указан"}
                      </span>
                      <span>ОКВЭД {company.okved.code}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
                  <ShieldCheck className="h-4 w-4 text-alfa-300" />
                  Профиль клиента банка
                </div>
              </div>

              <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HeroMetric
                  label="Выручка"
                  value={formatCompactMoney(company.revenue)}
                  icon={<Wallet className="h-4 w-4" />}
                />
                <HeroMetric
                  label="Прибыль"
                  value={formatCompactMoney(company.declared_profit)}
                  icon={<TrendingUp className="h-4 w-4" />}
                  tone={
                    company.declared_profit >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  }
                />
                <HeroMetric
                  label="Сотрудники"
                  value={formatNumber(company.employees)}
                  icon={<Users className="h-4 w-4" />}
                />
                <HeroMetric
                  label="Возраст бизнеса"
                  value={pluralYears(company.business_age_months)}
                  icon={<CalendarDays className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Данные используются для скоринга и ИИ-проверки цели кредита
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary/80"
              >
                Мои заявки
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Card>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <SectionCard
                title="Реквизиты компании"
                description="Основные сведения об организации."
                icon={<Building2 className="h-5 w-5" />}
              >
                <div className="grid gap-x-10 sm:grid-cols-2">
                  <DataRow label="Наименование" value={company.name} />
                  <DataRow label="ИНН" value={company.inn} mono />
                  <DataRow
                    label={registrationNumberLabel(company.legal_form)}
                    value={company.ogrn || "Не указан"}
                    mono={Boolean(company.ogrn)}
                  />
                  <DataRow label="ОКВЭД" value={company.okved.code} mono />
                  <div className="sm:col-span-2">
                    <DataRow label="Вид деятельности" value={company.okved.name} />
                  </div>
                  <DataRow
                    label="Просрочки"
                    value={
                      company.has_overdue ? (
                        <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-300">
                          <AlertTriangle className="h-4 w-4" />
                          Есть
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Нет
                        </span>
                      )
                    }
                  />
                  <DataRow label="Статус профиля" value="Активен" />
                </div>
              </SectionCard>

              <SectionCard
                title="Финансовые показатели"
                description="Заявленные компанией данные. Банк сверит их с ГИР БО и БКИ."
                icon={<CircleDollarSign className="h-5 w-5" />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <FinanceCard
                    label="Выручка за год"
                    value={formatCompactMoney(company.revenue)}
                    hint="заявленная"
                  />
                  <FinanceCard
                    label="Прибыль за год"
                    value={formatCompactMoney(company.declared_profit)}
                    hint={company.declared_profit >= 0 ? "прибыль" : "убыток"}
                    tone={
                      company.declared_profit >= 0
                        ? "text-emerald-600 dark:text-emerald-300"
                        : "text-red-600 dark:text-red-300"
                    }
                  />
                  <FinanceCard
                    label="Сотрудники"
                    value={formatNumber(company.employees)}
                    hint="человек"
                  />
                  <FinanceCard
                    label="Возраст бизнеса"
                    value={pluralYears(company.business_age_months)}
                    hint="по данным компании"
                  />
                </div>

                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                  <span className="font-semibold">Как это влияет на заявку:</span>{" "}
                  выручка, прибыль, возраст бизнеса и кредитная история участвуют
                  в расчёте скоринга. Официальные данные банк получает из
                  подключённых источников.
                </div>
              </SectionCard>

              <SectionCard
                title="Мои заявки"
                description="Краткая сводка по кредитным обращениям."
                icon={<FileText className="h-5 w-5" />}
                actions={
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
                  >
                    Все заявки
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                }
              >
                {applicationsQuery.isLoading ? (
                  <div className="space-y-3">
                    {[0, 1].map((item) => (
                      <Skeleton key={item} className="h-20 w-full" />
                    ))}
                  </div>
                ) : applicationsQuery.isError ? (
                  <p className="text-sm text-muted-foreground">
                    Не удалось загрузить заявки. Сводка временно недоступна.
                  </p>
                ) : applications.length === 0 ? (
                  <EmptyState
                    icon={<CircleDollarSign className="h-5 w-5" />}
                    title="Заявок пока нет"
                    description="Выберите продукт и отправьте первую заявку — решение придёт в кабинет."
                    action={
                      <Link
                        href="/applications/new"
                        className={buttonClass("primary", "sm")}
                      >
                        <Plus className="h-4 w-4" />
                        Подать заявку
                      </Link>
                    }
                  />
                ) : (
                  <>
                    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <SummaryMetric
                        label="Всего"
                        value={String(applications.length)}
                      />
                      <SummaryMetric
                        label="Одобрено"
                        value={String(approved.length)}
                        tone="text-emerald-600 dark:text-emerald-300"
                      />
                      <SummaryMetric
                        label="В работе"
                        value={String(inProgress.length)}
                        tone="text-amber-600 dark:text-amber-300"
                      />
                      <SummaryMetric
                        label="Отказано"
                        value={String(rejected.length)}
                        tone="text-red-600 dark:text-red-300"
                      />
                    </div>

                    <div className="divide-y divide-border">
                      {applications.slice(0, 3).map((application) => (
                        <Link
                          key={application.id}
                          href={`/applications/${application.id}`}
                          className="flex items-center justify-between gap-3 py-4 transition hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                #{application.id}
                              </span>
                              <StatusBadge status={application.status} />
                            </div>
                            <div className="mt-1.5 truncate text-base font-medium text-foreground">
                              {application.product.name}
                            </div>
                            <div className="mt-0.5 text-sm text-muted-foreground">
                              {formatMoney(application.amount)} ·{" "}
                              {formatDate(application.created_at)}
                            </div>
                          </div>
                          <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>

                    {approvedTotal > 0 ? (
                      <div className="mt-5 flex items-center justify-between rounded-lg bg-emerald-500/10 px-4 py-3">
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          Одобрено по всем заявкам
                        </span>
                        <span className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
                          {formatMoney(approvedTotal)}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
              </SectionCard>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-6">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold uppercase text-primary-foreground">
                    {user?.full_name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-foreground">
                      {user?.full_name}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {user?.email}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    Клиент банка
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {user?.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {company.name}
                  </div>
                </div>

                <Link
                  href="/applications/new"
                  className={buttonClass("primary", "md", "mt-5 w-full")}
                >
                  <Plus className="h-4 w-4" />
                  Новая заявка
                </Link>
              </Card>

              <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-accent to-card p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  Безопасность
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Данные профиля видны только вам и сотрудникам банка при
                  рассмотрении заявки. ИИ-проверка выполняется локально.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Что дальше
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Проверьте реквизиты и финансовые показатели. Если всё верно,
                  подайте заявку — банк автоматически соберёт данные и вынесет
                  решение.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/40">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-base font-semibold text-white sm:text-lg",
          tone,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[62%] text-right text-sm font-medium text-foreground",
          mono && "font-mono text-xs sm:text-sm",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FinanceCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-xl font-semibold tracking-tight text-foreground",
          tone,
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg bg-muted px-3 py-3 text-center">
      <div className={cn("text-xl font-semibold text-foreground", tone)}>
        {value}
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
