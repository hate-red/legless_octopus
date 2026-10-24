"use client";
import { useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import type { CompanyDocument, DocumentKind } from "@/shared/api/contracts";
import { api, errorMessage } from "@/shared/api/client";
import { date, number } from "@/shared/lib/format";
import { Alert, Button, Field, Input, Modal } from "@/shared/ui";

export const documentKinds: { kind: DocumentKind; title: string }[] = [
  { kind: "company", title: "Карточка компании" },
  { kind: "statement", title: "Выписка по счёту" },
  { kind: "finance", title: "Финансовая отчётность" },
];
export function DocumentList({
  documents,
  editable = false,
  onUpdated,
}: {
  documents: CompanyDocument[];
  editable?: boolean;
  onUpdated?: () => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<{
    kind: DocumentKind;
    file: File;
  } | null>(null);
  const [kind, setKind] = useState<DocumentKind>("company");
  const [period, setPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const rows = editable
    ? documentKinds
    : documents.map((doc) => ({ kind: doc.kind, title: doc.title }));
  async function upload() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/company/documents/${selected.kind}?filename=${encodeURIComponent(selected.file.name)}&period=${encodeURIComponent(period)}`,
        {
          method: "PUT",
          body: selected.file,
          headers: { "Content-Type": "application/pdf" },
        },
      );
      setSelected(null);
      await onUpdated?.();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="docs-list">
        {rows.map((row) => {
          const document = documents.find((doc) => doc.kind === row.kind);
          return (
            <div key={row.kind} className="document-row">
              <span className="square-icon">
                <FileText size={21} />
              </span>
              <div className="document-main">
                <h3>{row.title}</h3>
                <p>
                  {document
                    ? `${document.filename} · ${number(document.size / 1024)} КБ`
                    : "Добавьте документ PDF"}
                </p>
                {document && (
                  <p>
                    {document.period ||
                      `Загружен ${date(document.uploaded_at)}`}
                  </p>
                )}
              </div>
              <div className="document-actions">
                {document && (
                  <a
                    className="btn btn-ghost"
                    href={`/api/backend/company/documents/${document.id}/content`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Открыть ${row.title}`}
                  >
                    <Download size={16} />
                    <span>Открыть</span>
                  </a>
                )}
                {editable && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setKind(row.kind);
                      setError("");
                      picker.current?.click();
                    }}
                  >
                    <Upload size={15} />
                    {document ? "Заменить" : "Добавить"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <input
        ref={picker}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Загрузить PDF"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (
            !file.name.toLowerCase().endsWith(".pdf") ||
            file.size > 10 * 1024 * 1024
          ) {
            setError("Выберите PDF размером до 10 МБ");
            return;
          }
          setPeriod(documents.find((doc) => doc.kind === kind)?.period ?? "");
          setSelected({ kind, file });
        }}
      />
      {error && !selected && <Alert>{error}</Alert>}
      <Modal
        open={!!selected}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title="Обновить документ"
      >
        <p className="muted">{selected?.file.name}</p>
        <div className="document-period">
          <Field
            label="Период или дата документа"
            hint="Например: январь — июнь 2026 года"
          >
            <Input
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              maxLength={255}
              placeholder="Укажите период"
            />
          </Field>
          <p className="fine-print">
            Новая версия сохранится в компании. Документы ранее отправленных
            заявок останутся прежними.
          </p>
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="modal-actions">
          <Button onClick={() => setSelected(null)} disabled={busy}>
            Отмена
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void upload()}>
            Сохранить документ
          </Button>
        </div>
      </Modal>
    </>
  );
}
