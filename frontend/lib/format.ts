import type { ApplicationStatus, RepaymentType } from "@/lib/types";

export function formatMoney(
  value: number | null | undefined,
  fractionDigits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)} ₽`;
}

export function formatCompactMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: millions % 1 === 0 ? 0 : 1,
    }).format(millions)} млн ₽`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000)} тыс. ₽`;
  }
  return formatMoney(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

export function pluralMonths(months: number): string {
  const mod10 = months % 10;
  const mod100 = months % 100;
  if (mod10 === 1 && mod100 !== 11) return `${months} месяц`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${months} месяца`;
  }
  return `${months} месяцев`;
}

export function pluralYears(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return pluralMonths(months);
  const yearWord =
    years % 10 === 1 && years % 100 !== 11
      ? "год"
      : years % 10 >= 2 && years % 10 <= 4 && (years % 100 < 12 || years % 100 > 14)
        ? "года"
        : "лет";
  if (rest === 0) return `${years} ${yearWord}`;
  return `${years} ${yearWord} ${rest} мес.`;
}

const REPAYMENT_TYPE_LABELS: Record<RepaymentType, string> = {
  annuity: "Аннуитетный платёж",
  differentiated: "Дифференцированный платёж",
};

export function repaymentTypeLabel(value: RepaymentType | string): string {
  return REPAYMENT_TYPE_LABELS[value as RepaymentType] ?? value;
}

export function collateralLabel(required: boolean): string {
  return required ? "Требуется залог" : "Без залога";
}

export function revolvingLabel(isRevolving: boolean): string {
  return isRevolving ? "Возобновляемая линия" : "Срочный кредит";
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Черновик",
  VALIDATION: "Проверка лимитов",
  ENRICHMENT: "Сбор данных",
  AI_PURPOSE_CHECK: "ИИ-проверка цели",
  SCORING: "Скоринг",
  APPROVED: "Одобрено",
  COUNTER_OFFER: "Встречное предложение",
  MANUAL_REVIEW: "Ручная проверка",
  REJECTED: "Отказано",
  CONTRACT_SIGNING: "Подписание договора",
  DISBURSED: "Средства выданы",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as ApplicationStatus] ?? status;
}

export const ACTOR_LABELS: Record<string, string> = {
  client: "Клиент",
  bank: "Банк",
  system: "Система",
};

export function scoreTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-ink-400";
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  if (score >= 30) return "text-orange-600";
  return "text-red-600";
}

export function dtiTone(dti: number | null | undefined): string {
  if (dti === null || dti === undefined) return "text-ink-400";
  if (dti < 30) return "text-emerald-600";
  if (dti <= 50) return "text-amber-600";
  return "text-red-600";
}
