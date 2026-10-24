"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { ProtectedPage } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  SectionCard,
  Skeleton,
  buttonClass,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  legalFormLabel,
  pluralMonths,
  pluralYears,
  registrationNumberLabel,
  registryLabel,
  scoreTone,
} from "@/lib/format";
import type { ApplicationListItem, ApplicationStatus } from "@/lib/types";

const productIcons: Record<string, typeof Wallet> = {
  UNSECURED: Wallet,
  SECURED: Building2,
  CREDIT_LINE: RefreshCw,
};

const inProgressStatuses: ApplicationStatus[] = [
  "VALIDATION",
  "ENRICHMENT",
  "AI_PURPOSE_CHECK",
  "SCORING",
  "MANUAL_REVIEW",
  "COUNTER_OFFER",
];

export default function DashboardPage() {
  return (
    <ProtectedPage role="client">
      <DashboardContent />
    </ProtectedPage>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const applicationsQuery = useQuery({
    queryKey: ["applications"],
    queryFn: () => apiFetch<ApplicationListItem[]>("/applications"),
  });
  const applications = applicationsQuery.data ?? [];
  const company = user?.company;
  const firstName = user?.full_name.split(" ")[1] ?? user?.full_name ?? "";
  const firstNameText =
    firstName && firstName.length > 1
      ? firstName
      : user?.full_name.split(" ")[0] ?? "коллега";

  const approved = applications.filter((application) =>
    ["APPROVED", "CONTRACT_SIGNING", "DISBURSED"].includes(application.status),
  );
  const approvedCount = approved.length;
  const rejectedCount = applications.filter(
    (application) => application.status === "REJECTED",
  ).length;
  const inProgressCount = applications.filter((application) =>
    inProgressStatuses.includes(application.status),
  ).length;
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
            Кредитный кабинет
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Здравствуйте, {firstNameText}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {company?.name ?? "Профиль компании"} ·{" "}
            {applications.length > 0
              ? `${applications.length} ${applications.length === 1 ? "заявка" : "заявки"} в кредитном кабинете`
              : "подайте первую заявку онлайн"}
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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Всего заявок"
          value={String(applications.length)}
          hint="за всё время"
          icon={<FileText className="h-5 w-5" />}
          tone="bg-foreground text-background"
        />
        <MetricCard
          label="Одобрено"
          value={String(approvedCount)}
          hint={approvedTotal > 0 ? formatCompactMoney(approvedTotal) : "пока нет"}
          icon={<Banknote className="h-5 w-5" />}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
        />
        <MetricCard
          label="В работе"
          value={String(inProgressCount)}
          hint="проверки и решения"
          icon={<Clock3 className="h-5 w-5" />}
          tone="bg-sky-500/10 text-sky-600 dark:text-sky-300"
        />
        <MetricCard
          label="Отказано"
          value={String(rejectedCount)}
          hint="с указанием причины"
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="bg-red-500/10 text-red-600 dark:text-red-300"
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <SectionCard
            title="Мои заявки"
            description="Статусы обновляются автоматически после каждой проверки."
            icon={<FileText className="h-5 w-5" />}
            actions={
              applicationsQuery.isFetching ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Обновление
                </span>
              ) : null
            }
            className="min-h-[340px]"
          >
            {applicationsQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-32 w-full" />
                ))}
              </div>
            ) : applicationsQuery.isError ? (
              <Alert tone="danger" title="Не удалось загрузить заявки">
                <p>{applicationsQuery.error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => applicationsQuery.refetch()}
                >
                  Повторить
                </Button>
              </Alert>
            ) : applications.length === 0 ? (
              <EmptyState
                icon={<CircleDollarSign className="h-5 w-5" />}
                title="Пока нет заявок"
                description="Выберите продукт, укажите сумму и цель — банк проверит данные и вынесет решение."
                action={
                  <Link href="/applications/new" className={buttonClass("primary")}>
                    <Plus className="h-4 w-4" />
                    Подать заявку
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {applications.map((application) => (
                  <ApplicationRow
                    key={application.id}
                    application={application}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Как проходит рассмотрение"
            description="Прозрачный процесс: от заявки до денег на счёте."
            icon={<Sparkles className="h-5 w-5" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  step: "01",
                  title: "Заявка",
                  text: "Продукт, сумма, срок и цель кредита.",
                },
                {
                  step: "02",
                  title: "Проверки",
                  text: "ЕГРЮЛ, ГИР БО, БКИ и локальный ИИ.",
                },
                {
                  step: "03",
                  title: "Решение",
                  text: "Скоринг, DTI и автоматические правила.",
                },
                {
                  step: "04",
                  title: "Деньги",
                  text: "Подписание договора и зачисление.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-lg border border-border bg-muted/40 p-4"
                >
                  <div className="text-xs font-semibold tracking-wider text-primary">
                    {item.step}
                  </div>
                  <div className="mt-2 text-base font-semibold text-foreground">
                    {item.title}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          {company ? (
            <Card className="overflow-hidden">
              <div className="bg-zinc-950 p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/60">
                    {registryLabel(company.legal_form)} ·{" "}
                    {legalFormLabel(company.legal_form)}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold leading-snug">
                  {company.name}
                </h3>
                <div className="mt-1 text-sm text-white/45">
                  ИНН {company.inn} ·{" "}
                  {registrationNumberLabel(company.legal_form)}{" "}
                  {company.ogrn || "не указан"}
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">ОКВЭД</span>
                  <span className="max-w-[210px] text-right text-sm font-medium text-foreground">
                    {company.okved.code} · {company.okved.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CompanyMetric label="Выручка" value={formatCompactMoney(company.revenue)} />
                  <CompanyMetric
                    label="Прибыль"
                    value={formatCompactMoney(company.declared_profit)}
                    tone={company.declared_profit >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}
                  />
                  <CompanyMetric
                    label="Возраст"
                    value={pluralYears(company.business_age_months)}
                  />
                  <CompanyMetric label="Сотрудники" value={String(company.employees)} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Данные подтверждаются при заявке
                  </span>
                  <Link
                    href="/profile"
                    className="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary transition hover:text-primary/80"
                  >
                    Профиль
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-accent to-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-4 w-4" />
              Умный подбор
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Не уверены в сумме? Подайте заявку — система рассчитает комфортную
              долговую нагрузку и предложит условия.
            </p>
            <Link
              href="/applications/new"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
            >
              Подобрать кредит
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            tone,
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function CompanyMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-base font-semibold text-foreground", tone)}>
        {value}
      </div>
    </div>
  );
}

function ApplicationRow({ application }: { application: ApplicationListItem }) {
  const Icon = productIcons[application.product.code] ?? CircleDollarSign;
  const isCounter = application.status === "COUNTER_OFFER";
  return (
    <Link
      href={`/applications/${application.id}`}
      className={cn(
        "group block rounded-xl border p-4 transition-colors sm:p-5",
        isCounter
          ? "border-amber-200 bg-amber-50/40 hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:border-amber-700"
          : "border-border bg-card hover:border-ring/40 hover:bg-muted/30",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
            isCounter
              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Заявка #{application.id}
                </span>
                <StatusBadge status={application.status} />
              </div>
              <h3 className="mt-2 truncate text-base font-semibold text-foreground">
                {application.product.name}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {application.purpose}
              </p>
            </div>
            <ChevronRight className="mt-1 hidden h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="text-lg font-semibold text-foreground">
                {formatMoney(application.amount)}
              </span>
              <span>{pluralMonths(application.term_months)}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(application.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isCounter && application.counter_offer_amount ? (
                <div className="rounded-lg border border-amber-200 bg-card px-3 py-1.5 text-right shadow-sm dark:border-amber-900">
                  <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-300">
                    Предложение банка
                  </div>
                  <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {formatMoney(application.counter_offer_amount)}
                  </div>
                </div>
              ) : null}
              {application.score !== null ? (
                <div className="text-right">
                  <div
                    className={cn(
                      "text-xl font-semibold leading-none",
                      scoreTone(application.score),
                    )}
                  >
                    {application.score}
                    <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                      /100
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    скор
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
