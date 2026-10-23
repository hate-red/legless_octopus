"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Inbox,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { ProtectedPage } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  formatDate,
  formatMoney,
  pluralMonths,
  scoreTone,
  STATUS_LABELS,
  statusLabel,
} from "@/lib/format";
import type {
  ApplicationListItem,
  ApplicationStatus,
  Product,
} from "@/lib/types";

const QUICK_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Все заявки" },
  { value: "MANUAL_REVIEW", label: "Ручная проверка" },
  { value: "APPROVED", label: "Одобрено" },
  { value: "COUNTER_OFFER", label: "Встречные" },
  { value: "REJECTED", label: "Отказы" },
];

const ALL_STATUS_OPTIONS = [
  "VALIDATION",
  "ENRICHMENT",
  "AI_PURPOSE_CHECK",
  "SCORING",
  "APPROVED",
  "COUNTER_OFFER",
  "MANUAL_REVIEW",
  "REJECTED",
  "CONTRACT_SIGNING",
  "DISBURSED",
];

export default function BankApplicationsPage() {
  return (
    <ProtectedPage role="bank">
      <BankApplicationsContent />
    </ProtectedPage>
  );
}

function BankApplicationsContent() {
  const [statusFilter, setStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => apiFetch<Product[]>("/products"),
    staleTime: 300_000,
  });

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (productFilter) params.set("product_code", productFilter);
  if (appliedSearch) params.set("search", appliedSearch);
  const queryString = params.toString();

  const applicationsQuery = useQuery({
    queryKey: ["bank-applications", statusFilter, productFilter, appliedSearch],
    queryFn: () =>
      apiFetch<ApplicationListItem[]>(
        `/bank/applications${queryString ? `?${queryString}` : ""}`,
      ),
    placeholderData: keepPreviousData,
  });

  const applications = applicationsQuery.data ?? [];
  const manualCount = applications.filter(
    (application) => application.status === "MANUAL_REVIEW",
  ).length;
  const approvedCount = applications.filter((application) =>
    ["APPROVED", "CONTRACT_SIGNING", "DISBURSED"].includes(application.status),
  ).length;
  const rejectedCount = applications.filter(
    (application) => application.status === "REJECTED",
  ).length;
  const approvedAmount = applications
    .filter((application) =>
      ["APPROVED", "CONTRACT_SIGNING", "DISBURSED"].includes(
        application.status,
      ),
    )
    .reduce(
      (sum, application) =>
        sum + (application.approved_amount ?? application.amount),
      0,
    );

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setStatusFilter("");
    setProductFilter("");
    setSearchInput("");
    setAppliedSearch("");
  };

  const hasFilters = Boolean(statusFilter || productFilter || appliedSearch);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-purple-500">
            <span className="h-px w-5 bg-purple-500" />
            Кабинет банка
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Заявки бизнеса
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Все заявки после автоматических проверок — в единой очереди.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700">
          <Sparkles className="h-3.5 w-3.5" />
          Автоматизация + ручные решения
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <BankMetric
          label="В выборке"
          value={String(applications.length)}
          hint="заявок"
          icon={<Inbox className="h-4 w-4" />}
          tone="bg-foreground text-background"
        />
        <BankMetric
          label="На ручной проверке"
          value={String(manualCount)}
          hint="требуют решения"
          icon={<UserRound className="h-4 w-4" />}
          tone="bg-purple-50 text-purple-700"
        />
        <BankMetric
          label="Одобрено"
          value={String(approvedCount)}
          hint={formatMoney(approvedAmount)}
          icon={<Banknote className="h-4 w-4" />}
          tone="bg-emerald-50 text-emerald-700"
        />
        <BankMetric
          label="Отказано"
          value={String(rejectedCount)}
          hint="по правилам риска"
          icon={<ShieldAlert className="h-4 w-4" />}
          tone="bg-red-50 text-red-700"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1 pb-1">
              {QUICK_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition",
                    statusFilter === filter.value
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Компания, ИНН, номер заявки"
                  className="input h-10 w-full pl-9 pr-8 text-sm sm:w-64"
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setAppliedSearch("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </form>
              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={productFilter}
                  onChange={(event) => setProductFilter(event.target.value)}
                  className="input h-10 cursor-pointer py-0 pl-8 pr-8 text-sm sm:w-48"
                >
                  <option value="">Все продукты</option>
                  {productsQuery.data?.map((product) => (
                    <option key={product.id} value={product.code}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative hidden xl:block">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="input h-10 cursor-pointer py-0 pl-8 pr-8 text-sm sm:w-48"
                >
                  <option value="">Любой статус</option>
                  {ALL_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status as ApplicationStatus]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-[11px] text-muted-foreground">Активные фильтры:</span>
              {statusFilter ? (
                <FilterChip
                  label={statusLabel(statusFilter)}
                  onRemove={() => setStatusFilter("")}
                />
              ) : null}
              {productFilter ? (
                <FilterChip
                  label={
                    productsQuery.data?.find(
                      (product) => product.code === productFilter,
                    )?.name ?? productFilter
                  }
                  onRemove={() => setProductFilter("")}
                />
              ) : null}
              {appliedSearch ? (
                <FilterChip
                  label={`«${appliedSearch}»`}
                  onRemove={() => {
                    setAppliedSearch("");
                    setSearchInput("");
                  }}
                />
              ) : null}
              <button
                type="button"
                onClick={resetFilters}
                className="ml-1 text-[11px] font-medium text-primary hover:text-primary"
              >
                Сбросить всё
              </button>
              {applicationsQuery.isFetching ? (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Обновление
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {applicationsQuery.isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-16 w-full" />
            ))}
          </div>
        ) : applicationsQuery.isError ? (
          <div className="p-5">
            <Alert tone="danger" title="Не удалось загрузить заявки">
              <p>{applicationsQuery.error.message}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => applicationsQuery.refetch()}
              >
                Повторить
              </Button>
            </Alert>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="Заявок по фильтрам нет"
              description="Измените параметры поиска или сбросьте фильтры, чтобы увидеть все заявки."
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Сбросить фильтры
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="w-[70px] px-3 py-3 font-medium">Заявка</th>
                    <th className="w-[22%] px-3 py-3 font-medium">Клиент</th>
                    <th className="w-[18%] px-3 py-3 font-medium">Продукт</th>
                    <th className="w-[15%] px-3 py-3 text-right font-medium">Сумма</th>
                    <th className="w-[8%] px-3 py-3 text-center font-medium">Скор / 100</th>
                    <th className="w-[20%] px-3 py-3 font-medium">Статус</th>
                    <th className="w-[40px] px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((application) => (
                    <tr
                      key={application.id}
                      className="group transition hover:bg-muted/60"
                    >
                      <td className="px-3 py-3.5">
                        <Link
                          href={`/bank/applications/${application.id}`}
                          className="block"
                        >
                          <div className="font-medium text-foreground">
                            #{application.id}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDate(application.created_at)}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="line-clamp-2 font-medium leading-tight text-foreground">
                              {application.client.company?.name ?? "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              ИНН {application.client.company?.inn ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="line-clamp-2 leading-tight text-muted-foreground">
                          {application.product.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {pluralMonths(application.term_months)}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <div className="whitespace-nowrap font-semibold text-foreground">
                          {formatMoney(application.amount)}
                        </div>
                        {application.status === "COUNTER_OFFER" &&
                        application.counter_offer_amount ? (
                          <div className="whitespace-nowrap text-[11px] leading-tight text-amber-600">
                            оффер {formatMoney(application.counter_offer_amount)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={cn(
                            "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm font-semibold",
                            application.score !== null
                              ? "bg-muted"
                              : "bg-transparent",
                            scoreTone(application.score),
                          )}
                        >
                          {application.score ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusBadge
                          status={application.status}
                          className="text-[13px] leading-tight"
                        />
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <Link
                          href={`/bank/applications/${application.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-foreground hover:shadow-sm"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border xl:hidden">
              {applications.map((application) => (
                <Link
                  key={application.id}
                  href={`/bank/applications/${application.id}`}
                  className="block p-4 transition hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-tight text-foreground">
                        {application.client.company?.name ?? "—"}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StatusBadge
                          status={application.status}
                          className="shrink-0 px-2 py-0.5 text-[10px] leading-tight"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          #{application.id} · {formatDate(application.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {formatMoney(application.amount)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {application.product.name} ·{" "}
                        {pluralMonths(application.term_months)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-lg font-semibold",
                          scoreTone(application.score),
                        )}
                      >
                        {application.score ?? "—"}
                        {application.score !== null ? (
                          <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">
                            /100
                          </span>
                        ) : null}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function BankMetric({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
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
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
