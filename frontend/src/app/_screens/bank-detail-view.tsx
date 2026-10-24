"use client";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { BankDecision } from "@/features/bank-review/ui/decision";
import { DocumentList } from "@/features/documents/ui/documents";
import {
  CompanyMetrics,
  ReadData,
  Score,
  StatusBadge,
} from "@/entities/cabinet/ui";
import type {
  ApplicationDetail,
  CompanyDocument,
} from "@/shared/api/contracts";
import { dateTime, money, statusLabels } from "@/shared/lib/format";
import { PageHeader } from "@/widgets/app-shell";

export function BankDetailView({
  application,
  documents,
  onUpdated,
}: {
  application: ApplicationDetail;
  documents: CompanyDocument[];
  onUpdated: (value: ApplicationDetail) => void;
}) {
  const company = application.client.company;
  return (
    <>
      <Link className="text-link bank-back" href="/bank/applications">
        <ArrowLeft size={15} />
        Все заявки
      </Link>
      <PageHeader
        title={company?.name ?? `Заявка № ${application.id}`}
        subtitle={`Заявка № ${application.id} · ${dateTime(application.created_at)} · Данные для примера`}
        action={<StatusBadge status={application.status} />}
      />
      <section className="panel bank-brief">
        <dl className="read-data">
          <div>
            <dt>Сумма</dt>
            <dd className="bank-brief-amount">{money(application.amount)}</dd>
          </div>
          <div>
            <dt>Срок</dt>
            <dd>{application.term_months} мес.</dd>
          </div>
          <div>
            <dt>На что нужны деньги</dt>
            <dd>{application.purpose}</dd>
          </div>
        </dl>
      </section>
      <div className="bank-detail-grid">
        <div className="stack">
          {company && (
            <section className="panel company-section">
              <div className="spread">
                <h3>О компании</h3>
                <span className="fine-print">Данные клиента</span>
              </div>
              <ReadData
                rows={[
                  { label: "ИНН", value: company.inn },
                  { label: "ОГРН", value: company.ogrn },
                  {
                    label: "Контактное лицо",
                    value: application.client.full_name,
                  },
                  { label: "Email", value: application.client.email },
                  {
                    label: "Деятельность",
                    value: `${company.okved.code} · ${company.okved.name}`,
                    wide: true,
                  },
                  {
                    label: "Юридический адрес",
                    value: company.details.legal_address,
                    wide: true,
                  },
                ]}
              />
              <CompanyMetrics company={company} />
            </section>
          )}
          <section className="panel company-section">
            <div className="spread">
              <h3>Документы</h3>
              <span className="fine-print">{documents.length} документа</span>
            </div>
            <DocumentList documents={documents} />
          </section>
          <section className="panel company-section">
            <h3>Проверки системы</h3>
            <div className="bank-checks">
              <div>
                <CheckCircle2 size={18} />
                <div>
                  <strong>Финансовые показатели</strong>
                  <p>
                    {application.financial_verification
                      ? `Выручка ${money(application.financial_verification.official_revenue)} · прибыль ${money(application.financial_verification.official_profit)}`
                      : "Данные ещё не получены"}
                  </p>
                </div>
              </div>
              <div>
                <ShieldCheck size={18} />
                <div>
                  <strong>Кредитная история</strong>
                  <p>
                    {application.bki_check
                      ? `Рейтинг ${application.bki_check.bki_score} · просрочек ${application.bki_check.overdue_count} · платежи ${money(application.bki_check.monthly_payments)}/мес.`
                      : "Проверка ещё не выполнена"}
                  </p>
                </div>
              </div>
              <div>
                <CheckCircle2 size={18} />
                <div>
                  <strong>Цель финансирования</strong>
                  <p>
                    {application.ai_check?.ai_comment ??
                      "Проверка ещё не выполнена"}
                  </p>
                </div>
              </div>
            </div>
            {application.financial_verification?.flags.map((flag, index) => (
              <p className="fine-print" key={index} style={{ marginTop: 15 }}>
                {flag}
              </p>
            ))}
          </section>
          {application.scoring_result && (
            <details className="disclosure">
              <summary>
                Факторы скоринга · DTI {application.scoring_result.dti_percent}%
              </summary>
              <div className="disclosure-body">
                {application.scoring_result.factors.map((factor) => (
                  <div className="factor-row" key={factor.factor}>
                    <div>
                      <strong>
                        {factor.label} · {factor.value}
                      </strong>
                      <p>{factor.description}</p>
                    </div>
                    <span
                      className={`factor-points ${factor.points < 0 ? "negative" : ""}`}
                    >
                      {factor.points > 0 ? "+" : ""}
                      {factor.points}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
          <section className="panel company-section">
            <h3>История заявки</h3>
            <ol className="timeline">
              {[...application.status_history]
                .sort((a, b) => b.id - a.id)
                .map((item) => (
                  <li key={item.id}>
                    <time>{dateTime(item.created_at)}</time>
                    <strong>{statusLabels[item.status]}</strong>
                    <p>{item.comment}</p>
                  </li>
                ))}
            </ol>
          </section>
        </div>
        <aside className="bank-detail-aside">
          {application.status === "MANUAL_REVIEW" ? (
            <BankDecision application={application} onUpdated={onUpdated} />
          ) : (
            <section className="panel panel-padding">
              <h3>Решение по заявке</h3>
              <p className="muted" style={{ marginTop: 14 }}>
                {application.decision?.decision_reason ??
                  statusLabels[application.status]}
              </p>
            </section>
          )}
          <section className="panel panel-padding">
            <Score value={application.score} meter />
            <p className="fine-print" style={{ marginTop: 18 }}>
              Скор рассчитан системой. Изучите факторы и проверки перед
              принятием решения.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
