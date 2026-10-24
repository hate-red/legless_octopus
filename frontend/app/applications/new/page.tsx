"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  Info,
  Landmark,
  Loader2,
  Percent,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import { ProtectedPage } from "@/components/app-shell";
import {
  Alert,
  Button,
  Card,
  SectionCard,
  Skeleton,
  buttonClass,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import {
  collateralLabel,
  formatMoney,
  formatPercent,
  legalFormLabel,
  pluralMonths,
  repaymentTypeLabel,
  revolvingLabel,
} from "@/lib/format";
import type {
  ApplicationCreateInput,
  ApplicationDetail,
  Product,
} from "@/lib/types";

const schema = z.object({
  product_id: z.number().min(1, "Выберите кредитный продукт"),
  amount: z
    .number({ invalid_type_error: "Введите сумму кредита" })
    .positive("Сумма должна быть больше нуля"),
  term_months: z
    .number({ invalid_type_error: "Укажите срок" })
    .int("Срок указывается в целых месяцах")
    .positive("Укажите срок"),
  purpose: z
    .string()
    .min(10, "Опишите цель кредита — минимум 10 символов")
    .max(1000, "Слишком длинное описание"),
});

type FormValues = z.infer<typeof schema>;

const productMeta: Record<string, { icon: typeof Wallet; accent: string }> = {
  UNSECURED: {
    icon: Wallet,
    accent: "bg-sky-50 text-sky-600",
  },
  SECURED: {
    icon: Landmark,
    accent: "bg-violet-50 text-violet-600",
  },
  CREDIT_LINE: {
    icon: RefreshCw,
    accent: "bg-amber-50 text-amber-600",
  },
};

const PURPOSE_SUGGESTIONS = [
  "Покупка серверов",
  "Закупка товара",
  "Пополнение оборотных средств",
  "Покупка оборудования",
  "Развитие бизнеса",
];

const STEPS = [
  { number: 1, title: "Продукт", description: "Выберите цель кредита" },
  { number: 2, title: "Условия", description: "Сумма, срок и назначение" },
  { number: 3, title: "Проверка", description: "Подтвердите заявку" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function NewApplicationPage() {
  return (
    <ProtectedPage role="client">
      <NewApplicationContent />
    </ProtectedPage>
  );
}

function NewApplicationContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => apiFetch<Product[]>("/products"),
    staleTime: 300_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      product_id: 0,
      amount: 0,
      term_months: 24,
      purpose: "",
    },
  });

  const productId = watch("product_id");
  const amount = watch("amount");
  const termMonths = watch("term_months");
  const purpose = watch("purpose");
  const selectedProduct = productsQuery.data?.find(
    (product) => product.id === productId,
  );

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: ApplicationCreateInput = {
        product_id: values.product_id,
        amount: values.amount,
        term_months: values.term_months,
        purpose: values.purpose.trim(),
      };
      const created = await apiFetch<ApplicationDetail>("/applications", {
        method: "POST",
        body: payload,
      });
      return apiFetch<ApplicationDetail>(
        `/applications/${created.id}/submit`,
        { method: "POST" },
      );
    },
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      router.push(`/applications/${application.id}`);
    },
    onError: (error) => {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Не удалось отправить заявку. Попробуйте ещё раз.",
      );
    },
  });

  const pickProduct = (product: Product, currentAmount?: number, currentTerm?: number) => {
    const defaultAmount = clamp(
      currentAmount && currentAmount > 0 ? currentAmount : 1_000_000,
      product.min_amount,
      product.max_amount,
    );
    const defaultTerm = clamp(
      currentTerm && currentTerm > 0 ? currentTerm : 24,
      product.min_term_months,
      product.max_term_months,
    );
    setValue("product_id", product.id, { shouldValidate: true, shouldDirty: true });
    setValue("amount", Math.round(defaultAmount), { shouldValidate: true });
    setValue("term_months", defaultTerm, { shouldValidate: true });
  };

  useEffect(() => {
    if (!productsQuery.data?.length) return;
    if (productId) return;
    const first = productsQuery.data[0];
    setValue("product_id", first.id, { shouldValidate: false });
    setValue(
      "amount",
      clamp(1_000_000, first.min_amount, first.max_amount),
    );
    setValue(
      "term_months",
      clamp(24, first.min_term_months, first.max_term_months),
    );
  }, [productId, productsQuery.data, setValue]);

  const estimatedPayment =
    amount > 0 && termMonths > 0 ? (amount / termMonths) * 1.2 : 0;

  const goNext = async () => {
    setSubmitError(null);
    if (step === 1) {
      const valid = await trigger("product_id");
      if (!valid || !selectedProduct) return;
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === 2) {
      const valid = await trigger(["amount", "term_months", "purpose"]);
      if (!valid) return;
      if (!selectedProduct) {
        setError("product_id", { message: "Выберите продукт" });
        setStep(1);
        return;
      }
      if (amount < selectedProduct.min_amount || amount > selectedProduct.max_amount) {
        setError("amount", {
          message: `Сумма должна быть от ${formatMoney(selectedProduct.min_amount)} до ${formatMoney(selectedProduct.max_amount)}`,
        });
        return;
      }
      if (
        termMonths < selectedProduct.min_term_months ||
        termMonths > selectedProduct.max_term_months
      ) {
        setError("term_months", {
          message: `Срок должен быть от ${selectedProduct.min_term_months} до ${selectedProduct.max_term_months} мес.`,
        });
        return;
      }
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    setSubmitError(null);
    setStep((current) => Math.max(1, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = (values: FormValues) => {
    setSubmitError(null);
    if (step !== 3) {
      // Enter in a step-2 field must not skip the confirmation screen.
      void goNext();
      return;
    }
    createMutation.mutate(values);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        К моим заявкам
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="h-px w-5 bg-primary" />
            Новая заявка
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Кредит для вашего бизнеса
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Три шага — и заявка уйдёт на автоматическую проверку. Решение появится
            в кабинете, обычно в течение нескольких минут.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Данные защищены
        </div>
      </div>

      <Stepper currentStep={step} />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {productsQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-56 w-full" />
              ))}
            </div>
          ) : productsQuery.isError ? (
            <Alert tone="danger" title="Не удалось загрузить продукты">
              <p>{productsQuery.error.message}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => productsQuery.refetch()}
              >
                Повторить
              </Button>
            </Alert>
          ) : (
            <>
              {step === 1 ? (
                <div className="animate-fade-up space-y-3">
                  <div className="grid gap-3">
                    {productsQuery.data?.map((product) => {
                      const meta = productMeta[product.code] ?? {
                        icon: BriefcaseBusiness,
                        accent: "bg-muted text-muted-foreground",
                      };
                      const Icon = meta.icon;
                      const active = product.id === productId;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() =>
                            pickProduct(product, amount, termMonths)
                          }
                          className={cn(
                            "group relative flex flex-col gap-4 rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card sm:flex-row sm:items-start sm:p-5",
                            active
                              ? "border-primary ring-4 ring-primary/10 dark:ring-primary/20"
                              : "border-border hover:border-ring/40",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                              meta.accent,
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 pr-8">
                              <span className="text-base font-semibold text-foreground">
                                {product.name}
                              </span>
                              {active ? (
                                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                  Выбрано
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                              {product.description}
                            </span>
                            <span className="mt-3 flex flex-wrap gap-1.5">
                              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                {collateralLabel(product.collateral_required)}
                              </span>
                              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                {repaymentTypeLabel(product.repayment_type)}
                              </span>
                              <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                {revolvingLabel(product.is_revolving)}
                              </span>
                            </span>
                            <span className="mt-4 grid gap-2 border-t border-border pt-3 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-4">
                              <span className="flex items-center justify-between gap-2 sm:block">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Сумма
                                </span>
                                <span className="block whitespace-nowrap text-[13px] font-medium leading-snug text-foreground">
                                  {formatMoney(product.min_amount)} —{" "}
                                  {formatMoney(product.max_amount)}
                                </span>
                              </span>
                              <span className="flex items-center justify-between gap-2 sm:block">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Ставка от
                                </span>
                                <span className="block whitespace-nowrap text-[13px] font-medium leading-snug text-foreground">
                                  {formatPercent(product.base_rate)} годовых
                                </span>
                              </span>
                              <span className="flex items-center justify-between gap-2 sm:block">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Срок
                                </span>
                                <span className="block whitespace-nowrap text-[13px] font-medium leading-snug text-foreground">
                                  {product.min_term_months}–
                                  {product.max_term_months} мес.
                                </span>
                              </span>
                            </span>
                          </span>
                          {active ? (
                            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {errors.product_id ? (
                    <p className="text-xs text-red-600">
                      {errors.product_id.message}
                    </p>
                  ) : null}
                  <Alert tone="info">
                    <div className="flex gap-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Итоговая ставка и сумма зависят от результатов проверок.
                        Для расчёта используется выручка по ГИР БО и кредитная
                        история БКИ.
                      </span>
                    </div>
                  </Alert>
                </div>
              ) : null}

              {step === 2 && selectedProduct ? (
                <div className="animate-fade-up space-y-5">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Выбранный продукт
                        </div>
                        <div className="mt-1 text-sm font-semibold text-foreground">
                          {selectedProduct.name}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-medium text-primary hover:text-primary"
                      >
                        Изменить
                      </button>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-end justify-between gap-4">
                        <label htmlFor="amount" className="label mb-0">
                          Сумма кредита
                        </label>
                        <span className="text-[11px] text-muted-foreground">
                          {formatMoney(selectedProduct.min_amount)} —{" "}
                          {formatMoney(selectedProduct.max_amount)}
                        </span>
                      </div>
                      <div className="relative mt-2">
                        <input
                          id="amount"
                          type="number"
                          step="10000"
                          min={selectedProduct.min_amount}
                          max={selectedProduct.max_amount}
                          className={cn(
                            "input pr-10 text-lg font-semibold",
                            errors.amount && "border-red-300",
                          )}
                          {...register("amount", { valueAsNumber: true })}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ₽
                        </span>
                      </div>
                      <input
                        type="range"
                        min={selectedProduct.min_amount}
                        max={selectedProduct.max_amount}
                        step={10000}
                        value={clamp(amount || selectedProduct.min_amount, selectedProduct.min_amount, selectedProduct.max_amount)}
                        onChange={(event) =>
                          setValue("amount", Number(event.target.value), {
                            shouldValidate: true,
                          })
                        }
                        className="mt-4 w-full"
                        aria-label="Сумма кредита"
                      />
                      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>{formatMoney(selectedProduct.min_amount)}</span>
                        <span>{formatMoney(selectedProduct.max_amount)}</span>
                      </div>
                      {errors.amount ? (
                        <p className="mt-1.5 text-xs text-red-600">
                          {errors.amount.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between">
                        <span className="label mb-0">Срок кредита</span>
                        <span className="text-sm font-semibold text-foreground">
                          {pluralMonths(termMonths || selectedProduct.min_term_months)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={selectedProduct.min_term_months}
                        max={selectedProduct.max_term_months}
                        step={1}
                        value={clamp(
                          termMonths || selectedProduct.min_term_months,
                          selectedProduct.min_term_months,
                          selectedProduct.max_term_months,
                        )}
                        onChange={(event) =>
                          setValue("term_months", Number(event.target.value), {
                            shouldValidate: true,
                          })
                        }
                        className="mt-3 w-full"
                        aria-label="Срок кредита"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[6, 12, 24, 36, 60]
                          .filter(
                            (term) =>
                              term >= selectedProduct.min_term_months &&
                              term <= selectedProduct.max_term_months,
                          )
                          .map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() =>
                                setValue("term_months", term, {
                                  shouldValidate: true,
                                })
                              }
                              className={cn(
                                "rounded-lg border px-2.5 py-1 text-xs transition",
                                termMonths === term
                                  ? "border-alfa-300 bg-accent text-primary"
                                  : "border-border text-muted-foreground hover:border-border",
                              )}
                            >
                              {term} мес.
                            </button>
                          ))}
                      </div>
                      {errors.term_months ? (
                        <p className="mt-1.5 text-xs text-red-600">
                          {errors.term_months.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-6">
                      <label htmlFor="purpose" className="label">
                        Цель кредита
                      </label>
                      <textarea
                        id="purpose"
                        placeholder="Например: покупка серверов для разработки программного обеспечения"
                        className={cn(
                          "textarea",
                          errors.purpose && "border-red-300",
                        )}
                        {...register("purpose")}
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {PURPOSE_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() =>
                              setValue("purpose", suggestion, {
                                shouldValidate: true,
                              })
                            }
                            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-alfa-200 hover:text-primary"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1.5 flex items-start justify-between gap-3">
                        {errors.purpose ? (
                          <p className="text-xs text-red-600">
                            {errors.purpose.message}
                          </p>
                        ) : (
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Sparkles className="h-3 w-3" />
                            Цель проверит локальная ИИ-модель на соответствие ОКВЭД
                          </p>
                        )}
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {purpose.length}/1000
                        </span>
                      </div>
                    </div>
                  </Card>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <EstimateTile
                      label="Платёж в месяц"
                      value={formatMoney(estimatedPayment)}
                      hint="оценка, до проверки"
                    />
                    <EstimateTile
                      label="Ставка от"
                      value={`${formatPercent(selectedProduct.base_rate)}`}
                      hint="годовых"
                    />
                    <EstimateTile
                      label="Переплата*"
                      value={formatMoney(
                        Math.max(0, estimatedPayment * termMonths - (amount || 0)),
                      )}
                      hint="примерно за весь срок"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    * Предварительный расчёт. Итоговые условия банк определит после
                    проверки финансовых данных и кредитной истории.
                  </p>
                </div>
              ) : null}

              {step === 3 && selectedProduct ? (
                <div className="animate-fade-up space-y-5">
                  <SectionCard
                    title="Проверьте заявку"
                    description="После отправки изменить параметры нельзя — начнётся автоматическая проверка."
                    icon={<FileCheck2 className="h-[18px] w-[18px]" />}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-sm">
                          {(() => {
                            const meta = productMeta[selectedProduct.code];
                            const Icon = meta?.icon ?? BriefcaseBusiness;
                            return <Icon className="h-5 w-5" />;
                          })()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {selectedProduct.name}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {selectedProduct.description}
                          </p>
                        </div>
                      </div>

                      <dl className="divide-y divide-border">
                        <SummaryRow
                          label="Сумма кредита"
                          value={formatMoney(amount)}
                        />
                        <SummaryRow
                          label="Срок"
                          value={pluralMonths(termMonths)}
                        />
                        <SummaryRow
                          label="Оценка платежа"
                          value={`${formatMoney(estimatedPayment)} в месяц`}
                        />
                        <SummaryRow
                          label="Ставка от"
                          value={`${formatPercent(selectedProduct.base_rate)} годовых`}
                        />
                        <SummaryRow
                          label="Обеспечение"
                          value={collateralLabel(
                            selectedProduct.collateral_required,
                          )}
                        />
                        <SummaryRow
                          label="Погашение"
                          value={repaymentTypeLabel(
                            selectedProduct.repayment_type,
                          )}
                        />
                        <SummaryRow
                          label="Тип кредита"
                          value={revolvingLabel(selectedProduct.is_revolving)}
                        />
                        <div className="py-3">
                          <dt className="text-xs text-muted-foreground">Цель кредита</dt>
                          <dd className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                            {purpose}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </SectionCard>

                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                      Заявитель
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Компания</div>
                        <div className="mt-0.5 font-medium text-foreground">
                          {user?.company?.name ?? "Не заполнено"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Форма</div>
                        <div className="mt-0.5 font-medium text-foreground">
                          {legalFormLabel(user?.company?.legal_form)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">ИНН</div>
                        <div className="mt-0.5 font-medium text-foreground">
                          {user?.company?.inn ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">ОКВЭД</div>
                        <div className="mt-0.5 font-medium text-foreground">
                          {user?.company?.okved?.code ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Контакт</div>
                        <div className="mt-0.5 truncate font-medium text-foreground">
                          {user?.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="flex gap-2.5">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="text-xs leading-relaxed text-emerald-800">
                        Нажимая «Отправить заявку», вы соглашаетесь на проверку
                        данных в ЕГРЮЛ, ГИР БО и БКИ. Заявка будет рассмотрена
                        автоматически; при необходимости банк может запросить
                        дополнительные сведения.
                      </div>
                    </div>
                  </div>

                  {submitError ? (
                    <Alert tone="danger" title="Ошибка отправки">
                      {submitError}
                    </Alert>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={createMutation.isPending}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Назад
                </Button>
              ) : (
                <Link
                  href="/dashboard"
                  className={buttonClass("ghost", "md")}
                >
                  Отменить
                </Link>
              )}
            </div>
            {step < 3 ? (
              <Button
                type="button"
                onClick={(event) => {
                  // The same DOM node becomes the submit button on step 3;
                  // prevent the click default so the form is not submitted
                  // immediately after moving from step 2.
                  event.preventDefault();
                  void goNext();
                }}
                disabled={productsQuery.isLoading || !selectedProduct}
              >
                Продолжить
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                loading={createMutation.isPending}
                disabled={!selectedProduct}
              >
                {createMutation.isPending ? "Отправляем…" : "Отправить заявку"}
                {!createMutation.isPending ? (
                  <ArrowRight className="h-4 w-4" />
                ) : null}
              </Button>
            )}
          </div>
        </form>

        <aside className="sticky top-24 hidden space-y-4 lg:block">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ваша заявка
              </div>
            </div>
            <div className="p-5">
              {selectedProduct ? (
                <>
                  <div className="text-sm font-semibold text-foreground">
                    {selectedProduct.name}
                  </div>
                  <div className="mt-4 space-y-3">
                    <SidebarRow
                      label="Сумма"
                      value={amount > 0 ? formatMoney(amount) : "—"}
                    />
                    <SidebarRow
                      label="Срок"
                      value={termMonths > 0 ? pluralMonths(termMonths) : "—"}
                    />
                    <SidebarRow
                      label="Платёж"
                      value={
                        estimatedPayment > 0
                          ? formatMoney(estimatedPayment)
                          : "—"
                      }
                    />
                    <SidebarRow
                      label="Ставка от"
                      value={`${formatPercent(selectedProduct.base_rate)}`}
                    />
                  </div>
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Предварительно</span>
                      <span className="font-medium text-emerald-600">
                        до {formatPercent(selectedProduct.base_rate + 1)} годовых
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Выберите продукт, чтобы увидеть параметры заявки.
                </p>
              )}
            </div>
          </Card>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CircleHelp className="h-3.5 w-3.5" />
              Что проверит банк
            </div>
            <ul className="mt-3 space-y-2.5 text-xs text-muted-foreground">
              {[
                "Лимиты выбранного продукта",
                "Данные ЕГРЮЛ и официальную отчётность",
                "Кредитную историю и просрочки",
                "Соответствие цели профилю компании",
                "Долговую нагрузку (DTI)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-xs text-white/70">
            <Building2 className="h-4 w-4 shrink-0 text-alfa-300" />
            {user?.company?.name ?? "Профиль компании"}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((item, index) => {
          const active = item.number === currentStep;
          const done = item.number < currentStep;
          return (
            <div key={item.number} className="relative">
              {index < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "absolute left-[calc(50%+18px)] right-[-50%] top-5 hidden h-px sm:block",
                    done ? "bg-emerald-300" : "bg-muted",
                  )}
                />
              ) : null}
              <div className="relative z-10 flex flex-col items-center gap-1.5 text-center sm:items-start sm:gap-2 sm:text-left">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition",
                    active &&
                      "border-alfa-500 bg-primary text-white shadow-glow",
                    done && "border-emerald-200 bg-emerald-50 text-emerald-600",
                    !active && !done && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : item.number}
                </div>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </div>
                  <div className="hidden text-[11px] text-muted-foreground sm:block">
                    {item.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EstimateTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
