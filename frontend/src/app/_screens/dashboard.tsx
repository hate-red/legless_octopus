"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { useCabinet } from "@/entities/cabinet/model/store";
import { HomeResult } from "@/entities/cabinet/ui";
import { LoanWizard } from "@/widgets/loan-wizard";
import type { Application } from "@/shared/api/contracts";
import { api, errorMessage } from "@/shared/api/client";
import { dateTime, money } from "@/shared/lib/format";
import { Alert, Button, Loading, Modal } from "@/shared/ui";
import { NewApplicationLink, PageHeader } from "@/widgets/app-shell";

export function DashboardScreen() {
  const { ready, products, applications, error } = useCabinet();
  if (!ready) return error ? null : <Loading />;
  if (!products.length)
    return (
      <Alert>Нет доступных кредитных продуктов. Обратитесь в поддержку.</Alert>
    );
  return <DashboardContent initialEmpty={applications.length === 0} />;
}
function DashboardContent({ initialEmpty }: { initialEmpty: boolean }) {
  const { applications, products } = useCabinet();
  const [editing] = useState(initialEmpty);
  const [removed, setRemoved] = useState<Application | null>(null);
  const draft = applications.find((app) => app.status === "DRAFT");
  const submitted = applications.find((app) => app.status !== "DRAFT");
  if (removed)
    return (
      <>
        <PageHeader title="Главная" subtitle="Черновик заявки" />
        <DraftHero
          application={removed}
          initialDeleted
          onDismiss={() => setRemoved(null)}
        />
      </>
    );
  if (editing || (!draft && !submitted))
    return (
      <>
        <PageHeader
          title="Новая заявка"
          subtitle="Укажите цель, выберите продукт, сумму и срок."
        />
        <LoanWizard products={products} />
      </>
    );
  return (
    <>
      <PageHeader
        title="Главная"
        subtitle={
          draft
            ? "Продолжите оформление финансирования."
            : "Ваша оценка и условия финансирования."
        }
        action={<NewApplicationLink />}
      />
      {draft ? (
        <DraftHero application={draft} onDeleted={setRemoved} />
      ) : submitted ? (
        <HomeResult application={submitted} />
      ) : null}
    </>
  );
}
function DraftHero({
  application,
  initialDeleted = false,
  onDeleted,
  onDismiss,
}: {
  application: Application;
  initialDeleted?: boolean;
  onDeleted?: (application: Application) => void;
  onDismiss?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(initialDeleted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    try {
      await api(`/applications/${application.id}`, { method: "DELETE" });
      setConfirm(false);
      setDeleted(true);
      onDeleted?.(application);
      await useCabinet.getState().refresh("client", true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <Alert>{error}</Alert>}
      {deleted ? (
        <Alert
          tone="info"
          action={
            <Button
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/applications/${application.id}/restore`, {
                    method: "POST",
                  });
                  setDeleted(false);
                  await useCabinet.getState().refresh("client", true);
                  onDismiss?.();
                } catch (cause) {
                  setError(errorMessage(cause));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Восстановить
            </Button>
          }
        >
          Черновик удалён.
          <Button
            variant="ghost"
            onClick={() => {
              onDismiss?.();
              void useCabinet.getState().refresh("client", true);
            }}
          >
            Закрыть
          </Button>
        </Alert>
      ) : (
        <article className="panel draft-hero">
          <div>
            <p className="eyebrow">Черновик заявки</p>
            <h2>Продолжите заполнение заявки</h2>
            <p className="muted">
              Ваши данные сохранены. Завершите оформление, чтобы получить оценку
              системы.
            </p>
            <p className="result-purpose">{application.purpose}</p>
            <p className="draft-amount">
              {money(application.amount)}
              <small>на {application.term_months} мес.</small>
            </p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Link
                href={`/applications/${application.id}`}
                className="btn btn-primary"
              >
                Продолжить заявку
                <ArrowRight size={17} />
              </Link>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                <Trash2 size={15} />
                Удалить
              </Button>
            </div>
          </div>
          <div className="draft-steps">
            <h3>Осталось пройти</h3>
            {[
              { title: "Параметры", text: "Цель, продукт, сумма и срок" },
              { title: "Документы", text: "Подтвердите актуальность" },
              { title: "Проверка", text: "Проверьте данные и отправьте" },
            ].map((item, index) => (
              <div className="draft-step" key={item.title}>
                <span className="step-circle">{index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </div>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Создана {dateTime(application.created_at)}
          </p>
        </article>
      )}
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title="Удалить черновик?"
      >
        <p className="muted">Его можно будет восстановить после удаления.</p>
        <div className="modal-actions">
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            Оставить
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void remove()}>
            Удалить
          </Button>
        </div>
      </Modal>
    </>
  );
}
