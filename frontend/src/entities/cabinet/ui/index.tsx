"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FilePenLine,
  XCircle,
} from "lucide-react";
import type {
  Application,
  ApplicationStatus,
  Company,
} from "@/shared/api/contracts";
import {
  ageLabel,
  applicationTerms,
  compactMoney,
  dateTime,
  money,
  statusLabels,
} from "@/shared/lib/format";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const Icon =
    status === "DRAFT"
      ? FilePenLine
      : status === "REJECTED"
        ? XCircle
        : ["APPROVED", "DISBURSED"].includes(status)
          ? CheckCircle2
          : status === "MANUAL_REVIEW"
            ? Clock3
            : CircleDashed;
  return (
    <span className="status" data-status={status}>
      <Icon size={15} />
      {statusLabels[status]}
    </span>
  );
}
export function Score({
  value,
  meter = false,
  label = "Скор по заявке",
}: {
  value: number | null;
  meter?: boolean;
  label?: string;
}) {
  return (
    <div className="home-score">
      <p className="score-label">{label}</p>
      <div
        className="score-value"
        aria-label={
          value === null ? "Скор ещё не рассчитан" : `Скор ${value} из 100`
        }
      >
        <strong>{value ?? "—"}</strong>
        {value !== null && <span>/100</span>}
      </div>
      {meter && value !== null && (
        <>
          <div
            className="score-meter"
            role="meter"
            aria-label="Кредитный скор"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
          >
            <span style={{ width: `${value}%` }} />
          </div>
          <div className="score-scale">
            <span>0</span>
            <span>100</span>
          </div>
        </>
      )}
    </div>
  );
}
export function LoanMetrics({ application }: { application: Application }) {
  const terms = applicationTerms(application);
  return (
    <dl className="metrics">
      <div>
        <dt>
          {application.status === "COUNTER_OFFER"
            ? "Предлагаемая сумма"
            : "Сумма заявки"}
        </dt>
        <dd>{money(terms.amount)}</dd>
      </div>
      <div>
        <dt>Платёж в месяц</dt>
        <dd>{money(terms.monthly)}</dd>
      </div>
      <div>
        <dt>Срок</dt>
        <dd>{terms.term} мес.</dd>
      </div>
    </dl>
  );
}
export function ResultSummary({ application }: { application: Application }) {
  const descriptions: Partial<Record<ApplicationStatus, string>> = {
    APPROVED:
      "По предварительной оценке доступна запрошенная сумма. Посмотрите условия и расчёт платежа.",
    COUNTER_OFFER:
      "Для выбранного срока подобрали сумму с меньшей ежемесячной нагрузкой.",
    MANUAL_REVIEW:
      "Нужно уточнить финансовые данные. В результате оценки можно посмотреть, что использовала система.",
    REJECTED:
      "Сейчас система не может одобрить выбранные параметры. Посмотрите причины решения.",
    CONTRACT_SIGNING:
      "Условия подтверждены. Осталось подписать кредитный договор.",
    DISBURSED: "Договор подписан. Финансирование предоставлено вашей компании.",
  };
  return (
    <div className="home-result-main">
      <Score value={application.score} meter />
      <div className="result-copy">
        <p className="eyebrow">Результат оценки</p>
        <h2>{statusLabels[application.status]}</h2>
        <p className="muted">
          {descriptions[application.status] ??
            "Заявка отправлена. Результат появится здесь автоматически после проверки."}
        </p>
        <p className="result-purpose">{application.purpose}</p>
      </div>
    </div>
  );
}
export function HomeResult({ application }: { application: Application }) {
  return (
    <>
      <article className="panel home-result">
        <div className="spread">
          <span className="card-reference">Заявка № {application.id}</span>
          <StatusBadge status={application.status} />
        </div>
        <ResultSummary application={application} />
        <LoanMetrics application={application} />
        <footer className="card-footer">
          <Link
            className="btn btn-primary"
            href={`/applications/${application.id}`}
          >
            Посмотреть оценку
            <ArrowUpRight size={16} />
          </Link>
          <Link className="text-link" href="/applications">
            Мои заявки
            <ArrowRight size={16} />
          </Link>
          <time dateTime={application.created_at}>
            Создана {dateTime(application.created_at)}
          </time>
        </footer>
      </article>
      <p className="demo-note">
        Демонстрационная оценка · итоговые условия определяет банк
      </p>
    </>
  );
}
export function ApplicationCard({
  application,
  bank = false,
}: {
  application: Application;
  bank?: boolean;
}) {
  const draft = application.status === "DRAFT";
  return (
    <article className="panel request-card">
      <header className="spread">
        <span className="card-reference">
          {draft ? "Новая заявка" : `Заявка № ${application.id}`}
        </span>
        <StatusBadge status={application.status} />
      </header>
      {bank && (
        <p className="bank-application-company">
          {application.client.company?.name} · ИНН{" "}
          {application.client.company?.inn}
        </p>
      )}
      <h2>{application.purpose}</h2>
      <div className="request-body">
        <LoanMetrics application={application} />
        <div className="request-score">
          {application.score !== null ? (
            <Score value={application.score} label="Скор" />
          ) : (
            <>
              <p className="score-label">Скор</p>
              <p className="muted">
                {draft ? "После отправки заявки" : "Рассчитываем…"}
              </p>
            </>
          )}
        </div>
      </div>
      <footer className="card-footer">
        <time dateTime={application.created_at}>
          Создана {dateTime(application.created_at)}
        </time>
        <Link
          className={draft ? "btn btn-primary" : "text-link"}
          href={`${bank ? "/bank" : ""}/applications/${application.id}`}
        >
          {draft ? "Продолжить заполнение" : "Подробнее"}
          <ArrowUpRight size={16} />
        </Link>
      </footer>
    </article>
  );
}
export function CompanyMetrics({ company }: { company: Company }) {
  return (
    <dl className="company-metrics">
      <div>
        <dt>Выручка за год</dt>
        <dd>{compactMoney(company.revenue)}</dd>
      </div>
      <div>
        <dt>Прибыль за год</dt>
        <dd>{compactMoney(company.declared_profit)}</dd>
      </div>
      <div>
        <dt>Возраст компании</dt>
        <dd>{ageLabel(company.business_age_months)}</dd>
      </div>
      <div>
        <dt>Сотрудники</dt>
        <dd>{company.employees}</dd>
      </div>
    </dl>
  );
}
export function ReadData({
  rows,
}: {
  rows: { label: string; value?: string | number | null; wide?: boolean }[];
}) {
  return (
    <dl className="read-data">
      {rows.map(({ label, value, wide }) => (
        <div key={label} className={wide ? "wide" : undefined}>
          <dt>{label}</dt>
          <dd>{value === "" || value == null ? "Не указано" : value}</dd>
        </div>
      ))}
    </dl>
  );
}
