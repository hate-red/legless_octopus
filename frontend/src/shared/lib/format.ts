import type { Application, ApplicationStatus } from "@/shared/api/contracts";

export const number = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
export const money = (value: number) => `${number(value)} ₽`;
export const compactMoney = (value: number) =>
  `${new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value)} ₽`;
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
export const initials = (value: string) =>
  value
    .replace(/^(ООО|ПАО|ОАО|АО|ИП)\s*/u, "")
    .replace(/[«»"]/g, "")
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
export const ageLabel = (months: number) => {
  const years = Math.floor(months / 12);
  return years < 1
    ? `${months} мес.`
    : `${years} ${years % 100 >= 11 && years % 100 <= 14 ? "лет" : years % 10 === 1 ? "год" : years % 10 >= 2 && years % 10 <= 4 ? "года" : "лет"}`;
};
export const statusLabels: Record<ApplicationStatus, string> = {
  DRAFT: "Черновик",
  VALIDATION: "Проверяем параметры",
  ENRICHMENT: "Собираем данные",
  AI_PURPOSE_CHECK: "Проверяем цель",
  SCORING: "Рассчитываем скор",
  APPROVED: "Предварительно одобрено",
  COUNTER_OFFER: "Есть другое предложение",
  MANUAL_REVIEW: "Дополнительная проверка",
  REJECTED: "Отказано",
  CONTRACT_SIGNING: "Ожидает подписания",
  DISBURSED: "Средства выданы",
};
export const processingStatuses: ApplicationStatus[] = [
  "VALIDATION",
  "ENRICHMENT",
  "AI_PURPOSE_CHECK",
  "SCORING",
];
export function loanCalculation(
  amount: number,
  months: number,
  annualRate: number,
  type: "annuity" | "differentiated" = "annuity",
) {
  if (!Number.isFinite(amount) || amount <= 0 || months <= 0)
    return { monthly: 0, overpayment: 0, total: 0 };
  const r = annualRate / 1200;
  if (type === "differentiated") {
    const monthly = amount / months + amount * r;
    const overpayment = (amount * r * (months + 1)) / 2;
    return { monthly, overpayment, total: amount + overpayment };
  }
  const monthly = r
    ? (amount * r) / (1 - Math.pow(1 + r, -months))
    : amount / months;
  return {
    monthly,
    overpayment: monthly * months - amount,
    total: monthly * months,
  };
}
export function applicationTerms(application: Application) {
  const amount =
    application.approval?.approved_amount ??
    (application.status === "COUNTER_OFFER"
      ? application.counter_offer_amount
      : null) ??
    application.amount;
  const term =
    application.approval?.approved_term_months ?? application.term_months;
  const rate =
    application.approval?.approved_rate ?? application.product.base_rate;
  return {
    amount,
    term,
    rate,
    ...loanCalculation(amount, term, rate, application.product.repayment_type),
  };
}
