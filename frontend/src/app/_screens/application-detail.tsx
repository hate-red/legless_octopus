"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileCheck, LoaderCircle } from "lucide-react";
import { useCabinet } from "@/entities/cabinet/model/store";
import {
  CompanyMetrics,
  LoanMetrics,
  ReadData,
  ResultSummary,
  StatusBadge,
} from "@/entities/cabinet/ui";
import { BankDecision } from "@/features/bank-review/ui/decision";
import { DocumentList } from "@/features/documents/ui/documents";
import { LoanWizard } from "@/widgets/loan-wizard";
import { Calculation } from "@/features/loan/ui/calculation";
import type {
  ApplicationDetail,
  CompanyDocument,
} from "@/shared/api/contracts";
import { api, errorMessage, jsonBody } from "@/shared/api/client";
import {
  applicationTerms,
  dateTime,
  money,
  processingStatuses,
  statusLabels,
} from "@/shared/lib/format";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Loading,
  Modal,
  Textarea,
} from "@/shared/ui";
import { BankDetailView } from "./bank-detail-view";
import { DocumentResponse } from "@/features/documents/ui/response";
import { PageHeader } from "@/widgets/app-shell";

export function ApplicationDetailScreen({
  id,
  bank = false,
}: {
  id: number;
  bank?: boolean;
}) {
  const [application, setApplication] = useState<ApplicationDetail | null>(
    null,
  );
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const products = useCabinet((state) => state.products);
  const reload = useCallback(async () => {
    try {
      const [detail, docs] = await Promise.all([
        api<ApplicationDetail>(`${bank ? "/bank" : ""}/applications/${id}`),
        api<CompanyDocument[]>(`/applications/${id}/documents`),
      ]);
      setApplication(detail);
      setDocuments(docs);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, bank]);
  // The effect subscribes to an external API; state updates happen after its response.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const timer = setInterval(() => {
      if (!document.hidden) void reload();
    }, 10000);
    return () => clearInterval(timer);
  }, [reload]);
  if (loading && !application) return <Loading />;
  if (!application)
    return (
      <EmptyState
        title="Не удалось открыть заявку"
        action={<Button onClick={() => void reload()}>Повторить</Button>}
      >
        {error || "Проверьте номер заявки"}
      </EmptyState>
    );
  if (application.status === "DRAFT" && !bank)
    return (
      <>
        <PageHeader
          title="Продолжить заявку"
          subtitle="Данные сохранены. Завершите оформление."
        />
        {products.length ? (
          <LoanWizard
            key={application.id}
            draft={application}
            products={products}
          />
        ) : (
          <Loading />
        )}
      </>
    );
  const company = application.client.company;
  const terms = applicationTerms(application);
  const processing = processingStatuses.includes(application.status);
  const update = (next: ApplicationDetail) => {
    setApplication(next);
    void useCabinet.getState().refresh(bank ? "bank" : "client", true);
  };
  if (bank)
    return (
      <>
        {error && <Alert>{error}</Alert>}
        <BankDetailView
          application={application}
          documents={documents}
          onUpdated={update}
        />
      </>
    );
  return (
    <>
      <PageHeader
        title={bank ? `Заявка № ${id}` : "Результат оценки"}
        subtitle={`Заявка № ${id} · Создана ${dateTime(application.created_at)}`}
        action={
          <Link
            className="btn btn-secondary"
            href={bank ? "/bank/applications" : "/applications"}
          >
            <ArrowLeft size={16} />К заявкам
          </Link>
        }
      />
      {error && (
        <Alert
          action={<Button onClick={() => void reload()}>Повторить</Button>}
        >
          {error}
        </Alert>
      )}
      <div className="stack">
        <section className="panel result-panel">
          <div className="spread">
            <span className="card-reference">{application.product.name}</span>
            <StatusBadge status={application.status} />
          </div>
          {processing ? (
            <>
              <h2 style={{ marginTop: 26 }}>Оцениваем вашу заявку</h2>
              <p className="muted">
                Система проверяет данные компании и рассчитывает кредитный скор.
              </p>
              <div className="processing-list">
                {processingStatuses.map((status, index) => {
                  const done =
                    processingStatuses.indexOf(application.status) > index;
                  const active = status === application.status;
                  return (
                    <div key={status}>
                      {done ? (
                        <CheckCircle2 size={22} />
                      ) : (
                        <LoaderCircle
                          className={active ? "spin" : ""}
                          size={22}
                        />
                      )}
                      <span>
                        {statusLabels[status]}
                        <small>
                          {done
                            ? "Готово"
                            : active
                              ? "В процессе"
                              : "Следующий этап"}
                        </small>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <ResultSummary application={application} />
          )}
          <LoanMetrics application={application} />
          {application.decision?.decision_reason && (
            <div className="document-confirmation">
              <h3>Решение системы</h3>
              <p>{application.decision.decision_reason}</p>
            </div>
          )}
          {!bank && (
            <ClientActions application={application} onUpdated={update} />
          )}
        </section>
        <p className="demo-note" style={{ marginTop: -8 }}>
          Демонстрационный скоринг и проверка данных · итоговые условия
          определяет банк
        </p>
        {!processing && (
          <section className="panel panel-padding">
            <h3>
              {application.approval
                ? "Условия финансирования"
                : "Предварительный расчёт"}
            </h3>
            <Calculation
              amount={terms.amount}
              months={terms.term}
              product={{ ...application.product, base_rate: terms.rate }}
            />
          </section>
        )}
        {application.scoring_result && (
          <details className="disclosure" open={bank}>
            <summary>Из чего складывается скор</summary>
            <div className="disclosure-body">
              {application.scoring_result.factors.map((factor) => (
                <div key={factor.factor} className="factor-row">
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
              <p className="fine-print">
                Долговая нагрузка: {application.scoring_result.dti_percent}%
              </p>
            </div>
          </details>
        )}
        <details className="disclosure" open={bank}>
          <summary>Данные проверки</summary>
          <div className="disclosure-body">
            <div style={{ paddingTop: 22 }}>
              <ReadData
                rows={[
                  {
                    label: "Выручка по источникам",
                    value: application.financial_verification
                      ? money(
                          application.financial_verification.official_revenue,
                        )
                      : "Проверка ещё не выполнена",
                  },
                  {
                    label: "Прибыль по источникам",
                    value: application.financial_verification
                      ? money(
                          application.financial_verification.official_profit,
                        )
                      : "—",
                  },
                  {
                    label: "Кредитный рейтинг БКИ",
                    value: application.bki_check?.bki_score,
                  },
                  {
                    label: "Просрочки",
                    value: application.bki_check?.overdue_count,
                  },
                  {
                    label: "Действующие кредиты",
                    value: application.bki_check?.active_loans,
                  },
                  {
                    label: "Текущие платежи в месяц",
                    value: application.bki_check
                      ? money(application.bki_check.monthly_payments)
                      : "—",
                  },
                  {
                    label: "Проверка цели кредита",
                    value: application.ai_check?.ai_comment,
                    wide: true,
                  },
                ]}
              />
            </div>
            {application.financial_verification?.flags.map((flag, index) => (
              <p key={index} className="fine-print" style={{ marginTop: 16 }}>
                {flag}
              </p>
            ))}
          </div>
        </details>
        {bank && company && (
          <section className="panel company-section">
            <h3>{company.name}</h3>
            <ReadData
              rows={[
                { label: "ИНН", value: company.inn },
                { label: "ОГРН", value: company.ogrn },
                {
                  label: "Основная деятельность",
                  value: `${company.okved.code} · ${company.okved.name}`,
                  wide: true,
                },
                {
                  label: "Контактное лицо",
                  value: application.client.full_name,
                },
                { label: "Email", value: application.client.email },
              ]}
            />
            <CompanyMetrics company={company} />
          </section>
        )}
        <details className="disclosure">
          <summary>Документы заявки · {documents.length}</summary>
          <div className="disclosure-body">
            {documents.length ? (
              <DocumentList documents={documents} />
            ) : (
              <p className="muted" style={{ paddingTop: 20 }}>
                Документы ещё не подтверждены
              </p>
            )}
          </div>
        </details>
        <details className="disclosure">
          <summary>История заявки</summary>
          <div className="disclosure-body">
            <ol className="timeline">
              {[...application.status_history].reverse().map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.created_at}>
                    {dateTime(entry.created_at)}
                  </time>
                  <strong>{statusLabels[entry.status]}</strong>
                  <p>{entry.comment}</p>
                </li>
              ))}
            </ol>
          </div>
        </details>
        {bank && application.status === "MANUAL_REVIEW" && (
          <BankDecision application={application} onUpdated={update} />
        )}
      </div>
    </>
  );
}
function ClientActions({
  application,
  onUpdated,
}: {
  application: ApplicationDetail;
  onUpdated: (application: ApplicationDetail) => void;
}) {
  const [action, setAction] = useState<
    | "confirm-conditions"
    | "accept-counter-offer"
    | "decline-counter-offer"
    | "sign-contract"
    | null
  >(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function perform() {
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      onUpdated(
        await api<ApplicationDetail>(
          `/applications/${application.id}/${action}`,
          {
            method: "POST",
            body:
              action === "decline-counter-offer"
                ? jsonBody({
                    comment:
                      comment.trim() || "Клиент отказался от предложения",
                  })
                : undefined,
          },
        ),
      );
      setAction(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="result-actions">
        <DocumentResponse application={application} onUpdated={onUpdated} />
        {application.status === "APPROVED" && (
          <Button
            variant="primary"
            onClick={() => setAction("confirm-conditions")}
          >
            Подтвердить условия
            <ArrowRightIcon />
          </Button>
        )}
        {application.status === "COUNTER_OFFER" && (
          <>
            <Button
              variant="primary"
              onClick={() => setAction("accept-counter-offer")}
            >
              Принять предложение
            </Button>
            <Button onClick={() => setAction("decline-counter-offer")}>
              Отказаться
            </Button>
          </>
        )}
        {application.status === "CONTRACT_SIGNING" && (
          <Button variant="primary" onClick={() => setAction("sign-contract")}>
            <FileCheck size={18} />
            Подписать договор
          </Button>
        )}
        {application.status === "REJECTED" && (
          <Link href="/applications/new" className="btn btn-primary">
            Изменить параметры новой заявки
          </Link>
        )}
      </div>
      <Modal
        open={!!action}
        onClose={() => {
          if (!busy) {
            setAction(null);
            setError("");
          }
        }}
        title={
          action === "decline-counter-offer"
            ? "Отказаться от предложения?"
            : action === "sign-contract"
              ? "Подписание договора"
              : "Подтвердить условия?"
        }
      >
        <p className="muted">
          {action === "sign-contract"
            ? "В деморежиме подтверждение переведёт заявку в статус «Средства выданы». Реальная электронная подпись не выполняется."
            : action === "decline-counter-offer"
              ? "Заявка будет закрыта. Вы сможете оформить новую с другими параметрами."
              : "Выбранные условия сохранятся в заявке. Следующий шаг — подписание договора."}
        </p>
        {action === "decline-counter-offer" && (
          <div style={{ marginTop: 20 }}>
            <Field label="Комментарий (необязательно)">
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1000}
              />
            </Field>
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="modal-actions">
          <Button disabled={busy} onClick={() => setAction(null)}>
            Отмена
          </Button>
          <Button busy={busy} variant="primary" onClick={() => void perform()}>
            {action === "decline-counter-offer" ? "Отказаться" : "Подтвердить"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}
