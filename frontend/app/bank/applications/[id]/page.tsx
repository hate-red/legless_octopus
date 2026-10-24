"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Cpu,
  FileSignature,
  FileText,
  Gauge,
  Info,
  Landmark,
  Mail,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
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
  SectionCard,
  Skeleton,
  buttonClass,
} from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  collateralLabel,
  dtiTone,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  legalFormLabel,
  pluralMonths,
  pluralYears,
  registrationNumberLabel,
  registryLabel,
  repaymentTypeLabel,
  revolvingLabel,
  scoreTone,
  statusLabel,
} from "@/lib/format";
import type { ApplicationDetail, BankDecisionInput } from "@/lib/types";

const decisionSchema = z.object({
  comment: z.string().max(2000, "Комментарий слишком длинный").optional(),
  approved_amount: z
    .number({ invalid_type_error: "Введите сумму" })
    .positive("Сумма должна быть больше нуля"),
  approved_term_months: z
    .number({ invalid_type_error: "Введите срок" })
    .int("Срок — целое число месяцев")
    .positive("Введите срок"),
  approved_rate: z
    .number({ invalid_type_error: "Введите ставку" })
    .positive("Ставка должна быть больше нуля")
    .max(100, "Ставка не может превышать 100%"),
});

type DecisionFormValues = z.infer<typeof decisionSchema>;

export default function BankApplicationDetailPage() {
  return (
    <ProtectedPage role="bank">
      <BankApplicationDetailContent />
    </ProtectedPage>
  );
}

function BankApplicationDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const applicationQuery = useQuery({
    queryKey: ["bank-application", id],
    queryFn: () =>
      apiFetch<ApplicationDetail>(`/bank/applications/${id}`),
    enabled: Boolean(id),
  });

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: {
      comment: "",
      approved_amount: 0,
      approved_term_months: 0,
      approved_rate: 0,
    },
  });

  const application = applicationQuery.data;

  useEffect(() => {
    if (!application) return;
    reset({
      comment: "",
      approved_amount:
        application.approval?.approved_amount ?? application.amount,
      approved_term_months:
        application.approval?.approved_term_months ?? application.term_months,
      approved_rate:
        application.approval?.approved_rate ?? application.product.base_rate,
    });
  }, [application?.id, reset]);

  const decisionMutation = useMutation({
    mutationFn: async (payload: BankDecisionInput) =>
      apiFetch<ApplicationDetail>(
        `/bank/applications/${id}/decision`,
        { method: "POST", body: payload },
      ),
    onSuccess: (updated) => {
      setActionError(null);
      setConfirmReject(false);
      setNotice("Решение банка сохранено и зафиксировано в истории заявки.");
      queryClient.setQueryData(["bank-application", id], updated);
      queryClient.invalidateQueries({ queryKey: ["bank-applications"] });
    },
    onError: (error) => {
      setNotice(null);
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Не удалось сохранить решение. Попробуйте ещё раз.",
      );
    },
  });

  const submitDecision = (
    decision: BankDecisionInput["decision"],
    values?: DecisionFormValues,
  ) => {
    setActionError(null);
    setNotice(null);
    const payload: BankDecisionInput = {
      decision,
      comment: values?.comment?.trim() || undefined,
    };
    if (decision === "APPROVED" && values) {
      payload.approved_amount = values.approved_amount;
      payload.approved_term_months = values.approved_term_months;
      payload.approved_rate = values.approved_rate;
    }
    decisionMutation.mutate(payload);
  };

  const handleApprove = handleSubmit((values) =>
    submitDecision("APPROVED", values),
  );

  const handleReject = () => {
    submitDecision("REJECTED", {
      comment: getValues("comment"),
      approved_amount: getValues("approved_amount"),
      approved_term_months: getValues("approved_term_months"),
      approved_rate: getValues("approved_rate"),
    });
  };

  const handleRequestInfo = () => {
    submitDecision("MANUAL_REVIEW", {
      comment: getValues("comment"),
      approved_amount: getValues("approved_amount"),
      approved_term_months: getValues("approved_term_months"),
      approved_rate: getValues("approved_rate"),
    });
  };

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    );
  }

  if (applicationQuery.isError || !application) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <EmptyState
          icon={<XCircle className="h-5 w-5" />}
          title="Заявка не найдена"
          description={
            applicationQuery.error?.message ?? "Возможно, заявка была удалена."
          }
          action={
            <Link
              href="/bank/applications"
              className={buttonClass("primary")}
            >
              К списку заявок
            </Link>
          }
        />
      </div>
    );
  }

  const company = application.client.company;
  const verification = application.financial_verification;
  const bki = application.bki_check;
  const ai = application.ai_check;
  const scoring = application.scoring_result;
  const isManual = application.status === "MANUAL_REVIEW";
  const pendingDecision = decisionMutation.variables?.decision;
  const isDecisionPending = decisionMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/bank/applications"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Все заявки
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Подана {formatDateTime(application.submitted_at ?? application.created_at)}
          {applicationQuery.isFetching ? (
            <RefreshCw className="ml-1 h-3 w-3 animate-spin" />
          ) : null}
        </div>
      </div>

      {notice ? (
        <Alert tone="success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </div>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Заявка #{application.id}
              </span>
              <StatusBadge status={application.status} />
              {company?.has_overdue ? (
                <span className="chip bg-red-50 text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  Есть просрочки
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {company?.name ?? "Клиент банка"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                ИНН {company?.inn ?? "—"}
              </span>
              <span className="flex items-center gap-1">
                <UserRound className="h-3 w-3" />
                {application.client.full_name}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {application.client.email}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Запрошенная сумма
                </div>
                <div className="text-2xl font-semibold text-foreground">
                  {formatMoney(application.amount)}
                </div>
              </div>
              <div className="h-7 w-px bg-muted" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Продукт
                </div>
                <div className="text-sm font-medium text-foreground">
                  {application.product.name}
                </div>
              </div>
              <div className="h-7 w-px bg-muted" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Срок
                </div>
                <div className="text-sm font-medium text-foreground">
                  {pluralMonths(application.term_months)}
                </div>
              </div>
              <div className="h-7 w-px bg-muted" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ставка от
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatPercent(application.product.base_rate)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-xl bg-muted px-5 py-4">
            <ScoreGauge score={application.score} size="md" />
            <div className="space-y-2.5">
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
                  ИИ-проверка
                </div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    ai?.is_purpose_valid ? "text-emerald-600" : "text-amber-600",
                  )}
                >
                  {ai
                    ? ai.is_purpose_valid
                      ? "Соответствует"
                      : "Не соответствует"
                    : "—"}
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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-5">
          <SectionCard
            title="Данные клиента"
            description={`Профиль компании из заявки и ${registryLabel(company?.legal_form)}.`}
            icon={<Building2 className="h-[18px] w-[18px]" />}
            actions={
              <span className="chip bg-sky-50 text-sky-700">
                <ShieldCheck className="h-3 w-3" />
                {registryLabel(company?.legal_form)} проверен
              </span>
            }
          >
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field
                label={`Компания · ${legalFormLabel(company?.legal_form)}`}
                value={company?.name ?? "—"}
              />
              <Field label="ОКВЭД" value={`${company?.okved?.code ?? "—"} · ${company?.okved?.name ?? ""}`} />
              <Field
                label={`ИНН / ${registrationNumberLabel(company?.legal_form)}`}
                value={`${company?.inn ?? "—"} / ${company?.ogrn ?? "—"}`}
              />
              <Field
                label="Контактное лицо"
                value={`${application.client.full_name} · ${application.client.email}`}
              />
              <Field
                label="Заявленная выручка"
                value={formatMoney(company?.revenue)}
              />
              <Field
                label="Заявленная прибыль"
                value={
                  <span
                    className={cn(
                      (company?.declared_profit ?? 0) < 0 && "text-red-600",
                    )}
                  >
                    {formatMoney(company?.declared_profit)}
                  </span>
                }
              />
              <Field
                label="Возраст бизнеса"
                value={pluralYears(company?.business_age_months ?? 0)}
              />
              <Field
                label="Сотрудники"
                value={String(company?.employees ?? "—")}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Финансовая проверка"
            description="Сравнение заявленных данных с официальной отчётностью ГИР БО."
            icon={<Scale className="h-[18px] w-[18px]" />}
            actions={
              verification ? (
                <span
                  className={cn(
                    "chip",
                    verification.flags.length
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {verification.flags.length
                    ? `${verification.flags.length} замечан.`
                    : "Без замечаний"}
                </span>
              ) : null
            }
          >
            {verification ? (
              <>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">
                          Показатель
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Заявлено
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          ГИР БО
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Отклонение
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <FinancialComparisonRow
                        label="Выручка"
                        declared={company?.revenue ?? 0}
                        official={verification.official_revenue}
                        diff={verification.revenue_diff_pct}
                      />
                      <FinancialComparisonRow
                        label="Прибыль"
                        declared={company?.declared_profit ?? 0}
                        official={verification.official_profit}
                        diff={verification.profit_diff_pct}
                      />
                    </tbody>
                  </table>
                </div>

                {verification.flags.length ? (
                  <div className="mt-4 space-y-2">
                    {verification.flags.map((flag) => (
                      <div
                        key={flag}
                        className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {flag}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Существенных расхождений с официальной отчётностью не выявлено.
                  </div>
                )}
              </>
            ) : (
              <NoData text="Финансовая проверка ещё не выполнялась." />
            )}
          </SectionCard>

          <div className="grid gap-5 md:grid-cols-2">
            <SectionCard
              title="БКИ и кредитная история"
              description="Данные бюро кредитных историй."
              icon={<Landmark className="h-[18px] w-[18px]" />}
            >
              {bki ? (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Кредитный рейтинг
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 text-3xl font-semibold",
                          bki.bki_score > 700
                            ? "text-emerald-600"
                            : bki.bki_score >= 500
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      >
                        {bki.bki_score}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {bki.bki_score > 700
                          ? "Высокий"
                          : bki.bki_score >= 500
                            ? "Средний"
                            : "Низкий"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Дисциплина
                      </div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatPercent(bki.payment_discipline_pct, 0)}
                      </div>
                    </div>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        bki.bki_score > 700
                          ? "bg-emerald-500"
                          : bki.bki_score >= 500
                            ? "bg-amber-500"
                            : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(100, bki.bki_score / 10)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat
                      label="Просрочки"
                      value={String(bki.overdue_count)}
                      danger={bki.overdue_count > 0}
                    />
                    <MiniStat
                      label="Активные кредиты"
                      value={String(bki.active_loans)}
                    />
                    <MiniStat
                      label="Платежи / мес."
                      value={formatMoney(bki.monthly_payments)}
                    />
                    <MiniStat
                      label="DTI"
                      value={scoring ? formatPercent(scoring.dti_percent) : "—"}
                      danger={(scoring?.dti_percent ?? 0) > 50}
                    />
                  </div>

                  {bki.overdue_count > 0 ? (
                    <Alert tone="danger">
                      Жёсткая блокировка: обнаружены просрочки. Автоматическое
                      одобрение невозможно.
                    </Alert>
                  ) : null}
                </div>
              ) : (
                <NoData text="Данные БКИ отсутствуют." />
              )}
            </SectionCard>

            <SectionCard
              title="ИИ-проверка цели"
              description="Локальная семантическая модель."
              icon={<Cpu className="h-[18px] w-[18px]" />}
            >
              {ai ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Заявленная цель
                    </div>
                    <p className="mt-1 rounded-xl bg-muted px-3 py-2.5 text-sm leading-relaxed text-foreground">
                      «{application.purpose}»
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "chip",
                        ai.is_purpose_valid
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {ai.is_purpose_valid ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {ai.is_purpose_valid
                        ? "Соответствует ОКВЭД"
                        : "Не соответствует ОКВЭД"}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatPercent(ai.similarity_score * 100, 0)}
                    </span>
                  </div>

                  <div className="relative">
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          ai.is_purpose_valid
                            ? "bg-emerald-500"
                            : "bg-amber-500",
                        )}
                        style={{
                          width: `${Math.round(ai.similarity_score * 100)}%`,
                        }}
                      />
                    </div>
                    <div
                      className="absolute -top-1 h-[18px] w-px bg-ink-400"
                      style={{ left: "50%" }}
                      title="Порог 50%"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>порог 50%</span>
                    <span>100%</span>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {ai.ai_comment}
                  </p>
                  <div className="flex items-center gap-1.5 border-t border-border pt-3 text-[10px] text-muted-foreground">
                    <Cpu className="h-3 w-3" />
                    paraphrase-multilingual-MiniLM-L12-v2 · локальный запуск
                  </div>
                </div>
              ) : (
                <NoData text="ИИ-проверка ещё не выполнялась." />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Скоринг заявки"
            description="Факторы, баллы и итоговая оценка риска."
            icon={<Gauge className="h-[18px] w-[18px]" />}
            actions={
              scoring ? (
                <span className={cn("chip bg-muted", scoreTone(scoring.score))}>
                  Итог: {scoring.score} / 100
                </span>
              ) : null
            }
          >
            {scoring ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-5 rounded-xl bg-muted/70 p-4 sm:flex-row sm:items-center">
                  <ScoreGauge score={scoring.score} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">
                        Оценка кредитоспособности
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          scoreTone(scoring.score),
                        )}
                      >
                        {scoring.score >= 75
                          ? "Высокая"
                          : scoring.score >= 50
                            ? "Средняя"
                            : scoring.score >= 30
                              ? "Спорная"
                              : "Низкая"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      База 50 баллов. Итог ограничен диапазоном 0–100. Порог
                      автоодобрения — 75 баллов.
                    </p>
                    <div className="mt-4">
                      <DtiBar value={scoring.dti_percent} />
                    </div>
                  </div>
                </div>
                <ScoringTable factors={scoring.factors} />
              </div>
            ) : (
              <NoData text="Скоринг ещё не рассчитан." />
            )}
          </SectionCard>

          <SectionCard
            title="История решений"
            description="Аудит всех действий по заявке."
            icon={<Clock3 className="h-[18px] w-[18px]" />}
          >
            <StatusTimeline items={application.status_history} />
          </SectionCard>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-zinc-950 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-alfa-300" />
                Решение по заявке
              </div>
              <StatusBadge status={application.status} showSpinner={false} />
            </div>

            {isManual ? (
              <form onSubmit={handleApprove} className="space-y-4 p-5">
                <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                  <div className="flex items-start gap-2 text-xs leading-relaxed text-purple-800">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Заявка требует решения менеджера. Проверьте отчётность,
                    кредитную историю и цель кредита.
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Параметры одобрения
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label htmlFor="approved_amount" className="label text-xs">
                        Сумма
                      </label>
                      <div className="relative">
                        <input
                          id="approved_amount"
                          type="number"
                          className={cn(
                            "input h-10 pr-8 text-sm",
                            errors.approved_amount && "border-red-300",
                          )}
                          {...register("approved_amount", {
                            valueAsNumber: true,
                          })}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₽
                        </span>
                      </div>
                      {errors.approved_amount ? (
                        <p className="mt-1 text-[10px] text-red-600">
                          {errors.approved_amount.message}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label
                        htmlFor="approved_term_months"
                        className="label text-xs"
                      >
                        Срок, мес.
                      </label>
                      <input
                        id="approved_term_months"
                        type="number"
                        className={cn(
                          "input h-10 text-sm",
                          errors.approved_term_months && "border-red-300",
                        )}
                        {...register("approved_term_months", {
                          valueAsNumber: true,
                        })}
                      />
                      {errors.approved_term_months ? (
                        <p className="mt-1 text-[10px] text-red-600">
                          {errors.approved_term_months.message}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor="approved_rate" className="label text-xs">
                        Ставка, %
                      </label>
                      <input
                        id="approved_rate"
                        type="number"
                        step="0.1"
                        className={cn(
                          "input h-10 text-sm",
                          errors.approved_rate && "border-red-300",
                        )}
                        {...register("approved_rate", {
                          valueAsNumber: true,
                        })}
                      />
                      {errors.approved_rate ? (
                        <p className="mt-1 text-[10px] text-red-600">
                          {errors.approved_rate.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="comment" className="label text-xs">
                    Комментарий к решению
                  </label>
                  <textarea
                    id="comment"
                    rows={3}
                    placeholder="Причина решения, дополнительные условия…"
                    className="input min-h-[84px] text-sm"
                    {...register("comment")}
                  />
                </div>

                {actionError ? (
                  <Alert tone="danger">{actionError}</Alert>
                ) : null}

                {confirmReject ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-medium text-red-800">
                      Подтвердите отказ по заявке
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-red-600">
                      Клиент увидит причину. Отменить решение после сохранения
                      нельзя.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        loading={
                          isDecisionPending && pendingDecision === "REJECTED"
                        }
                        onClick={handleReject}
                      >
                        Подтвердить отказ
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmReject(false)}
                        disabled={isDecisionPending}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2 border-t border-border pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    loading={
                      isDecisionPending && pendingDecision === "APPROVED"
                    }
                    disabled={isDecisionPending || confirmReject}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Одобрить заявку
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmReject(true)}
                      disabled={isDecisionPending || confirmReject}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Отклонить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={
                        isDecisionPending && pendingDecision === "MANUAL_REVIEW"
                      }
                      disabled={isDecisionPending || confirmReject}
                      onClick={handleRequestInfo}
                    >
                      <Info className="h-3.5 w-3.5" />
                      Доп. информация
                    </Button>
                  </div>
                </div>
                <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                  Решение будет зафиксировано в истории и станет доступно клиенту.
                </p>
              </form>
            ) : (
              <div className="space-y-4 p-5">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl p-3",
                    application.status === "APPROVED" ||
                      application.status === "CONTRACT_SIGNING" ||
                      application.status === "DISBURSED"
                      ? "bg-emerald-50 text-emerald-800"
                      : application.status === "REJECTED"
                        ? "bg-red-50 text-red-800"
                        : application.status === "COUNTER_OFFER"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-muted text-foreground",
                  )}
                >
                  {application.status === "REJECTED" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : application.status === "COUNTER_OFFER" ? (
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : application.status === "MANUAL_REVIEW" ? (
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="text-xs leading-relaxed">
                    <div className="font-semibold">
                      {application.status === "APPROVED"
                        ? "Заявка одобрена"
                        : application.status === "COUNTER_OFFER"
                          ? "Ожидается решение клиента"
                          : application.status === "REJECTED"
                            ? "Заявка отклонена"
                            : application.status === "CONTRACT_SIGNING"
                              ? "Клиент согласовал условия"
                              : application.status === "DISBURSED"
                                ? "Кредит выдан"
                                : "Заявка в обработке"}
                    </div>
                    <p className="mt-1 opacity-80">
                      {application.status === "COUNTER_OFFER"
                        ? "Банк предложил комфортную сумму. Решение за клиентом."
                        : application.status === "CONTRACT_SIGNING"
                          ? "Ожидается подписание договора клиентом."
                          : application.status === "DISBURSED"
                            ? "Договор подписан, средства перечислены."
                            : application.decision?.decision_reason ??
                              "Автоматические проверки выполняются."}
                    </p>
                  </div>
                </div>

                {application.approval?.approved_amount &&
                application.status !== "COUNTER_OFFER" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat
                      label="Одобрено"
                      value={formatMoney(application.approval.approved_amount)}
                    />
                    <MiniStat
                      label="Ставка"
                      value={formatPercent(application.approval.approved_rate)}
                    />
                  </div>
                ) : null}

                {application.status === "REJECTED" ? (
                  <div className="rounded-xl bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
                    Решение банка зафиксировано. Повторное решение по этой заявке
                    недоступно.
                  </div>
                ) : null}

                {application.status === "COUNTER_OFFER" &&
                application.counter_offer_amount ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-amber-600">
                      Встречное предложение
                    </div>
                    <div className="mt-1 text-lg font-semibold text-amber-800">
                      {formatMoney(application.counter_offer_amount)}
                    </div>
                    <div className="text-[11px] text-amber-700">
                      {pluralMonths(application.term_months)} ·{" "}
                      {formatPercent(application.approval?.approved_rate)}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Параметры заявки
            </div>
            <div className="mt-3 space-y-2.5 text-sm">
              <SidebarRow label="Продукт" value={application.product.name} />
              <SidebarRow
                label="Сумма"
                value={formatMoney(application.amount)}
              />
              <SidebarRow
                label="Срок"
                value={pluralMonths(application.term_months)}
              />
              <SidebarRow
                label="Ставка от"
                value={formatPercent(application.product.base_rate)}
              />
              <SidebarRow
                label="Обеспечение"
                value={collateralLabel(application.product.collateral_required)}
              />
              <SidebarRow
                label="Погашение"
                value={repaymentTypeLabel(application.product.repayment_type)}
              />
              <SidebarRow
                label="Тип кредита"
                value={revolvingLabel(application.product.is_revolving)}
              />
              <SidebarRow
                label="Подана"
                value={formatDate(application.submitted_at ?? application.created_at)}
              />
            </div>
            <div className="mt-4 rounded-xl bg-muted p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Цель кредита
              </div>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                {application.purpose}
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Чек-лист проверок
            </div>
            <div className="mt-3 space-y-2.5">
              {[
                {
                  label: "Лимиты продукта",
                  done: true,
                },
                {
                  label: "ЕГРЮЛ и ГИР БО",
                  done: Boolean(verification),
                },
                {
                  label: "Кредитная история БКИ",
                  done: Boolean(bki),
                },
                {
                  label: "ИИ-проверка цели",
                  done: Boolean(ai),
                },
                {
                  label: "Скоринг и DTI",
                  done: Boolean(scoring),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-muted-foreground">{item.label}</span>
                  {item.done ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              Справка
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Одобрение вручную доступно только для заявок на ручной проверке.
              Сумма и срок должны соответствовать лимитам продукта.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium leading-relaxed text-foreground">
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold",
          danger ? "text-red-600" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[200px] text-right text-xs font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function FinancialComparisonRow({
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
      <td className="px-4 py-3 font-medium text-foreground">{label}</td>
      <td className="px-4 py-3 text-right text-muted-foreground">
        {formatMoney(declared)}
      </td>
      <td className="px-4 py-3 text-right font-medium text-foreground">
        {formatMoney(official)}
      </td>
      <td
        className={cn(
          "px-4 py-3 text-right text-xs font-semibold",
          mismatch ? "text-amber-600" : "text-emerald-600",
        )}
      >
        <span className="inline-flex items-center gap-1">
          {diff >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {diff > 0 ? "+" : ""}
          {formatPercent(diff)}
        </span>
      </td>
    </tr>
  );
}

function NoData({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
      <FileText className="h-4 w-4" />
      {text}
    </div>
  );
}
