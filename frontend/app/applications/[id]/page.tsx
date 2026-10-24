"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cpu,
  FileSignature,
  FileText,
  Gauge,
  Handshake,
  Info,
  Landmark,
  Loader2,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingDown,
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";

import { ProtectedPage } from "@/components/app-shell";
import { DtiBar, ScoreGauge, ScoringTable } from "@/components/scoring";
import { StatusBadge } from "@/components/status-badge";
import { StatusTimeline } from "@/components/timeline";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  InfoRow,
  SectionCard,
  Skeleton,
  buttonClass,
} from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import {
  collateralLabel,
  dtiTone,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  pluralMonths,
  pluralYears,
  repaymentTypeLabel,
  revolvingLabel,
  scoreTone,
  statusLabel,
} from "@/lib/format";
import type { ApplicationDetail } from "@/lib/types";

const PROCESSING = new Set([
  "VALIDATION",
  "ENRICHMENT",
  "AI_PURPOSE_CHECK",
  "SCORING",
]);

export default function ApplicationDetailPage() {
  return (
    <ProtectedPage role="client">
      <ApplicationDetailContent />
    </ProtectedPage>
  );
}

function ApplicationDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);

  const applicationQuery = useQuery({
    queryKey: ["application", id],
    queryFn: () => apiFetch<ApplicationDetail>(`/applications/${id}`),
    enabled: Boolean(id),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      path,
      body,
    }: {
      path: string;
      body?: unknown;
    }) =>
      apiFetch<ApplicationDetail>(`/applications/${id}/${path}`, {
        method: "POST",
        body,
      }),
    onSuccess: (updated) => {
      setActionError(null);
      setDeclineOpen(false);
      queryClient.setQueryData(["application", id], updated);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Не удалось выполнить действие. Попробуйте ещё раз.",
      );
    },
  });

  const runAction = (path: string, body?: unknown) => {
    setActionError(null);
    actionMutation.mutate({ path, body });
  };

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (applicationQuery.isError || !applicationQuery.data) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <EmptyState
          icon={<XCircle className="h-5 w-5" />}
          title="Заявка не найдена"
          description={applicationQuery.error?.message ?? "Возможно, заявка была удалена."}
          action={
            <Link href="/dashboard" className={buttonClass("primary")}>
              Вернуться в кабинет
            </Link>
          }
        />
      </div>
    );
  }

  const application = applicationQuery.data;
  const isProcessing = PROCESSING.has(application.status);
  const isActionPending = actionMutation.isPending;
  const approval = application.approval;
  const approvedAmount =
    approval?.approved_amount ??
    (application.status === "COUNTER_OFFER"
      ? (application.counter_offer_amount ?? application.amount)
      : application.amount);
  const approvedTerm =
    approval?.approved_term_months ?? application.term_months;
  const approvedRate =
    approval?.approved_rate ?? application.product.base_rate;
  const scoring = application.scoring_result;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          Мои заявки
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Создана {formatDateTime(application.created_at)}
          {applicationQuery.isFetching ? (
            <RefreshCw className="ml-1 h-3 w-3 animate-spin" />
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Заявка #{application.id}
              </span>
              <StatusBadge status={application.status} />
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {application.product.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Запрошено
                </div>
                <div className="text-2xl font-semibold text-foreground">
                  {formatMoney(application.amount)}
                </div>
              </div>
              <div className="h-8 w-px bg-muted" />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Срок
                </div>
                <div className="text-sm font-medium text-foreground">
                  {pluralMonths(application.term_months)}
                </div>
              </div>
              <div className="h-8 w-px bg-muted" />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Ставка от
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatPercent(application.product.base_rate)} годовых
                </div>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {application.purpose}
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-xl bg-muted px-5 py-4">
            <ScoreGauge score={application.score} size="md" />
            <div className="space-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  DTI
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold",
                    dtiTone(scoring?.dti_percent),
                  )}
                >
                  {scoring ? formatPercent(scoring.dti_percent) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Решение
                </div>
                <div className="text-sm font-medium text-foreground">
                  {application.decision
                    ? statusLabel(application.decision.decision)
                    : "В обработке"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <ActionPanel
        application={application}
        approvedAmount={approvedAmount}
        approvedTerm={approvedTerm}
        approvedRate={approvedRate}
        isProcessing={isProcessing}
        isPending={isActionPending}
        actionError={actionError}
        declineOpen={declineOpen}
        onDeclineOpen={() => setDeclineOpen(true)}
        onDeclineCancel={() => setDeclineOpen(false)}
        onAction={runAction}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <SectionCard
            title="Ход рассмотрения"
            description="Все этапы фиксируются автоматически."
            icon={<Clock3 className="h-[18px] w-[18px]" />}
          >
            <StatusTimeline items={application.status_history} />
          </SectionCard>

          {application.financial_verification ||
          application.bki_check ||
          application.ai_check ||
          scoring ? (
            <SectionCard
              title="Как банк оценил заявку"
              description="Прозрачные данные проверок и расчёт скоринга."
              icon={<Gauge className="h-[18px] w-[18px]" />}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5 text-violet-500" />
                    ИИ-проверка цели
                  </div>
                  {application.ai_check ? (
                    <>
                      <div
                        className={cn(
                          "mt-2 text-sm font-semibold",
                          application.ai_check.is_purpose_valid
                            ? "text-emerald-600"
                            : "text-amber-600",
                        )}
                      >
                        {application.ai_check.is_purpose_valid
                          ? "Соответствует ОКВЭД"
                          : "Требует проверки"}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            application.ai_check.is_purpose_valid
                              ? "bg-emerald-500"
                              : "bg-amber-500",
                          )}
                          style={{
                            width: `${Math.round(
                              application.ai_check.similarity_score * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Сходство{" "}
                        {formatPercent(
                          application.ai_check.similarity_score * 100,
                          0,
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">Нет данных</div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 text-sky-500" />
                    БКИ
                  </div>
                  {application.bki_check ? (
                    <>
                      <div
                        className={cn(
                          "mt-2 text-sm font-semibold",
                          application.bki_check.bki_score >= 700
                            ? "text-emerald-600"
                            : application.bki_check.bki_score >= 500
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      >
                        Рейтинг {application.bki_check.bki_score}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Просрочки: {application.bki_check.overdue_count} · платежи{" "}
                        {formatMoney(application.bki_check.monthly_payments)}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">Нет данных</div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                    Скоринг
                  </div>
                  <div
                    className={cn(
                      "mt-2 text-sm font-semibold",
                      scoreTone(application.score),
                    )}
                  >
                    {application.score ?? "—"} из 100
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    DTI {scoring ? formatPercent(scoring.dti_percent) : "—"}
                  </div>
                </div>
              </div>

              {application.financial_verification ? (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Финансовая проверка
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Показатель</th>
                          <th className="px-3 py-2 text-right font-medium">Заявлено</th>
                          <th className="px-3 py-2 text-right font-medium">ГИР БО</th>
                          <th className="px-3 py-2 text-right font-medium">Разница</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <FinancialRow
                          label="Выручка"
                          declared={user?.company?.revenue ?? 0}
                          official={application.financial_verification.official_revenue}
                          diff={application.financial_verification.revenue_diff_pct}
                        />
                        <FinancialRow
                          label="Прибыль"
                          declared={user?.company?.declared_profit ?? 0}
                          official={application.financial_verification.official_profit}
                          diff={application.financial_verification.profit_diff_pct}
                        />
                      </tbody>
                    </table>
                  </div>
                  {application.financial_verification.flags.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      {application.financial_verification.flags.map((flag) => (
                        <div
                          key={flag}
                          className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {flag}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {application.ai_check ? (
                <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-violet-600 shadow-sm">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                        Комментарий ИИ-проверки
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {application.ai_check.ai_comment}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {scoring ? (
                <details className="group mt-5 rounded-xl border border-border">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      Детализация скоринга
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-open:rotate-90" />
                  </summary>
                  <div className="border-t border-border px-4 py-3">
                    <ScoringTable factors={scoring.factors} />
                  </div>
                </details>
              ) : null}
            </SectionCard>
          ) : isProcessing ? (
            <Card className="p-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                Заявка проходит проверки. Данные появятся здесь автоматически.
              </p>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Параметры заявки
              </div>
            </div>
            <div className="divide-y divide-border px-5 py-2">
              <InfoRow label="Продукт" value={application.product.name} />
              <InfoRow label="Сумма" value={formatMoney(application.amount)} />
              <InfoRow label="Срок" value={pluralMonths(application.term_months)} />
              <InfoRow
                label="Ставка от"
                value={`${formatPercent(application.product.base_rate)}`}
              />
              <InfoRow
                label="Обеспечение"
                value={collateralLabel(application.product.collateral_required)}
              />
              <InfoRow
                label="Погашение"
                value={repaymentTypeLabel(application.product.repayment_type)}
              />
              <InfoRow
                label="Тип кредита"
                value={revolvingLabel(application.product.is_revolving)}
              />
              {application.status === "COUNTER_OFFER" &&
              application.counter_offer_amount ? (
                <InfoRow
                  label="Предложение банка"
                  value={
                    <span className="text-amber-700">
                      {formatMoney(application.counter_offer_amount)}
                    </span>
                  }
                />
              ) : null}
              {application.approval?.approved_amount &&
              application.status !== "COUNTER_OFFER" ? (
                <InfoRow
                  label="Одобренная сумма"
                  value={
                    <span className="text-emerald-700">
                      {formatMoney(application.approval.approved_amount)}
                    </span>
                  }
                />
              ) : null}
            </div>
            <div className="border-t border-border bg-muted/40 px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Landmark className="h-3.5 w-3.5" />
                Заявка в Альфа-Банке
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Безопасность
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Банк проверяет данные только для рассмотрения заявки. Цель кредита
              анализируется локальной моделью — без передачи данных внешним
              ИИ-сервисам.
            </p>
          </Card>

          <div className="rounded-xl bg-zinc-950 p-5 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              <Info className="h-3.5 w-3.5" />
              Нужна помощь?
            </div>
            <p className="mt-2 text-sm text-white/80">
              Менеджер поможет разобраться с решением и условиями.
            </p>
            <div className="mt-3 text-sm font-semibold text-alfa-300">
              8 800 200-00-00
            </div>
            <div className="mt-1 text-[11px] text-white/35">
              Демонстрационный номер
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FinancialRow({
  label,
  declared,
  official,
  diff,
}: {
  label: string;
  declared: number;
  official: number;
  diff: number;
}) {
  const mismatch = Math.abs(diff) > 15;
  return (
    <tr>
      <td className="px-3 py-2.5 text-muted-foreground">{label}</td>
      <td className="px-3 py-2.5 text-right text-muted-foreground">
        {formatMoney(declared)}
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-foreground">
        {formatMoney(official)}
      </td>
      <td
        className={cn(
          "px-3 py-2.5 text-right font-medium",
          mismatch ? "text-amber-600" : "text-emerald-600",
        )}
      >
        {diff > 0 ? "+" : ""}
        {formatPercent(diff)}
      </td>
    </tr>
  );
}

function ActionPanel({
  application,
  approvedAmount,
  approvedTerm,
  approvedRate,
  isProcessing,
  isPending,
  actionError,
  declineOpen,
  onDeclineOpen,
  onDeclineCancel,
  onAction,
}: {
  application: ApplicationDetail;
  approvedAmount: number;
  approvedTerm: number;
  approvedRate: number;
  isProcessing: boolean;
  isPending: boolean;
  actionError: string | null;
  declineOpen: boolean;
  onDeclineOpen: () => void;
  onDeclineCancel: () => void;
  onAction: (path: string, body?: unknown) => void;
}) {
  const errorBlock = actionError ? (
    <Alert tone="danger" className="mt-4">
      {actionError}
    </Alert>
  ) : null;

  if (application.status === "COUNTER_OFFER") {
    const counterAmount =
      application.counter_offer_amount ??
      application.approval?.approved_amount ??
      0;
    return (
      <div className="animate-fade-up overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-card to-amber-50/40 shadow-card dark:border-amber-900 dark:from-amber-950/40 dark:via-card dark:to-amber-950/20">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Handshake className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                  Встречное предложение
                </div>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  Банк готов одобрить кредит на комфортную для вас сумму
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {application.decision?.decision_reason ??
                    "Мы рассчитали сумму, при которой долговая нагрузка останется в комфортном диапазоне."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Сумма: </span>
                    <span className="text-lg font-semibold text-amber-700">
                      {formatMoney(counterAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Срок: </span>
                    <span className="font-medium text-foreground">
                      {pluralMonths(approvedTerm)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ставка: </span>
                    <span className="font-medium text-foreground">
                      {formatPercent(approvedRate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {!declineOpen ? (
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                <Button
                  onClick={() =>
                    onAction("accept-counter-offer")
                  }
                  loading={isPending}
                  disabled={isPending}
                >
                  <ThumbsUp className="h-4 w-4" />
                  Принять предложение
                </Button>
                <Button
                  variant="outline"
                  onClick={onDeclineOpen}
                  disabled={isPending}
                >
                  Отказаться
                </Button>
              </div>
            ) : (
              <div className="w-full shrink-0 rounded-xl border border-amber-200 bg-card p-4 lg:w-72">
                <p className="text-sm font-medium text-foreground">
                  Отказаться от предложения?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Заявка получит статус «Отказано». Вы сможете подать новую заявку
                  позже.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    loading={isPending}
                    onClick={() =>
                      onAction("decline-counter-offer", { comment: "" })
                    }
                  >
                    Да, отказаться
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDeclineCancel}
                    disabled={isPending}
                  >
                    Оставить
                  </Button>
                </div>
              </div>
            )}
          </div>
          {errorBlock}
        </div>
      </div>
    );
  }

  if (application.status === "APPROVED") {
    return (
      <div className="animate-fade-up overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-card to-emerald-50/40 shadow-card dark:border-emerald-900 dark:from-emerald-950/40 dark:via-card dark:to-emerald-950/20">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
                Одобрено
              </div>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Кредит одобрен на запрошенных условиях
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {formatMoney(approvedAmount)} · {pluralMonths(approvedTerm)} ·{" "}
                {formatPercent(approvedRate)} годовых. Подтвердите условия, чтобы
                перейти к подписанию договора.
              </p>
            </div>
          </div>
          <Button
            onClick={() => onAction("confirm-conditions")}
            loading={isPending}
            disabled={isPending}
            className="shrink-0"
          >
            Подтвердить условия
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {errorBlock ? <div className="px-5 pb-5 sm:px-6">{errorBlock}</div> : null}
      </div>
    );
  }

  if (application.status === "CONTRACT_SIGNING") {
    return (
      <div className="animate-fade-up overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-card to-blue-50/40 shadow-card dark:border-blue-900 dark:from-blue-950/40 dark:via-card dark:to-blue-950/20">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                Подписание договора
              </div>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Условия согласованы — остался последний шаг
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Подпишите договор электронной подписью, и средства поступят на
                расчётный счёт. Сумма {formatMoney(approvedAmount)}, ставка{" "}
                {formatPercent(approvedRate)}.
              </p>
            </div>
          </div>
          <Button
            variant="dark"
            onClick={() => onAction("sign-contract")}
            loading={isPending}
            disabled={isPending}
            className="shrink-0"
          >
            <FileSignature className="h-4 w-4" />
            Подписать договор
          </Button>
        </div>
        {errorBlock ? <div className="px-5 pb-5 sm:px-6">{errorBlock}</div> : null}
      </div>
    );
  }

  if (application.status === "DISBURSED") {
    return (
      <div className="animate-fade-up overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white shadow-card sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
              Средства выданы
            </div>
            <h2 className="mt-0.5 text-lg font-semibold">
              {formatMoney(approvedAmount)} зачислены на счёт
            </h2>
            <p className="mt-1 text-sm text-emerald-50/80">
              Договор подписан, кредит активен. График платежей доступен в интернет-банке.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (application.status === "REJECTED") {
    return (
      <div className="animate-fade-up overflow-hidden rounded-xl border border-red-200 bg-gradient-to-br from-red-50 via-card to-red-50/40 shadow-card dark:border-red-900 dark:from-red-950/40 dark:via-card dark:to-red-950/20">
        <div className="flex gap-4 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-600">
              Решение банка
            </div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              По заявке принято отрицательное решение
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {application.decision?.decision_reason ??
                "К сожалению, заявка не соответствует условиям кредитования."}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Вы можете устранить причину отказа и подать новую заявку. Например,
              погасить просрочки или подтвердить официальную отчётность.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (application.status === "MANUAL_REVIEW") {
    return (
      <div className="animate-fade-up overflow-hidden rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 via-card to-purple-50/40 shadow-card dark:border-purple-900 dark:from-purple-950/40 dark:via-card dark:to-purple-950/20">
        <div className="flex gap-4 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-purple-600">
              Ручная проверка
            </div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Заявку проверяет кредитный менеджер
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {application.decision?.decision_reason ??
                "Автоматические проверки выявили спорный фактор. Решение примет менеджер банка."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Обычно это занимает не больше одного рабочего дня. Мы сообщим о
              решении в этом кабинете.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (application.status === "DRAFT") {
    return (
      <Alert tone="info" title="Черновик заявки">
        Заявка ещё не отправлена на рассмотрение. Подайте её из списка заявок.
      </Alert>
    );
  }

  if (isProcessing) {
    return (
      <div className="animate-fade-up overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-card to-sky-50/40 shadow-card dark:border-sky-900 dark:from-sky-950/40 dark:via-card dark:to-sky-950/20">
        <div className="flex gap-4 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-600">
              Обработка
            </div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Заявка проходит автоматические проверки
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Проверяем лимиты, данные ЕГРЮЛ, ГИР БО, БКИ и цель кредита. Обычно
              это занимает несколько секунд.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
