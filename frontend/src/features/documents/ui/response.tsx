"use client";
import { useState } from "react";
import { useCabinet } from "@/entities/cabinet/model/store";
import type { ApplicationDetail } from "@/shared/api/contracts";
import { api, errorMessage, jsonBody } from "@/shared/api/client";
import { Alert, Button, Modal } from "@/shared/ui";
import { DocumentList } from "./documents";
export function DocumentResponse({
  application,
  onUpdated,
}: {
  application: ApplicationDetail;
  onUpdated: (app: ApplicationDetail) => void;
}) {
  const documents = useCabinet((state) => state.documents);
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = [...application.status_history].sort((a, b) => b.id - a.id)[0];
  if (application.status !== "MANUAL_REVIEW" || latest?.actor_role !== "bank")
    return null;
  async function send() {
    setBusy(true);
    setError("");
    try {
      await api(`/applications/${application.id}/documents/respond`, {
        method: "POST",
        body: jsonBody({
          document_ids: documents.map((document) => document.id),
        }),
      });
      onUpdated(
        await api<ApplicationDetail>(`/applications/${application.id}`),
      );
      setOpen(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setAgreed(false);
          setOpen(true);
        }}
      >
        Предоставить документы
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Документы для проверки"
      >
        <p className="muted">{latest.comment}</p>
        <DocumentList
          documents={documents}
          editable
          onUpdated={async () => {
            setAgreed(false);
            await useCabinet.getState().refresh("client", true);
          }}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span>Подтверждаю актуальность документов</span>
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="modal-actions">
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={!agreed || documents.length !== 3}
            busy={busy}
            onClick={() => void send()}
          >
            Отправить документы
          </Button>
        </div>
      </Modal>
    </>
  );
}
