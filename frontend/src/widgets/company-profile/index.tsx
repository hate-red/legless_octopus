"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil } from "lucide-react";
import { useSession } from "@/entities/session/model/store";
import { useCabinet } from "@/entities/cabinet/model/store";
import { CompanyMetrics, ReadData } from "@/entities/cabinet/ui";
import { DocumentList } from "@/features/documents/ui/documents";
import { CompanyEditor, bankFields } from "@/features/company/ui/editor";
import type { User } from "@/shared/api/contracts";
import { errorMessage } from "@/shared/api/client";
import { initials } from "@/shared/lib/format";
import { Alert, Button, Tabs } from "@/shared/ui";
export function CompanyProfile({ user }: { user: User }) {
  const [tab, setTab] = useState<"info" | "bank" | "documents">("info");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const documents = useCabinet((state) => state.documents);
  const company = user.company;
  if (!company) return null;
  async function logout() {
    setLoggingOut(true);
    try {
      await useSession.getState().logout();
      useCabinet.getState().reset();
      router.replace("/login");
    } catch (cause) {
      setError(errorMessage(cause));
      setLoggingOut(false);
    }
  }
  if (editing)
    return (
      <CompanyEditor
        user={user}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          useSession.getState().setUser(updated);
          setEditing(false);
          setMessage("Изменения сохранены");
        }}
      />
    );
  return (
    <>
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
      <section className="panel company-summary">
        <div className="spread">
          <div className="company-title">
            <span className="company-avatar">{initials(company.name)}</span>
            <div>
              <h2>{company.name}</h2>
              <p>
                ИНН {company.inn} ·{" "}
                {company.legal_form === "IP"
                  ? "Индивидуальный предприниматель"
                  : "Общество с ограниченной ответственностью"}
              </p>
            </div>
          </div>
          <Button
            className="icon-btn"
            variant="ghost"
            aria-label="Изменить сведения компании"
            onClick={() => {
              setMessage("");
              setEditing(true);
            }}
          >
            <Pencil size={18} />
          </Button>
        </div>
        <CompanyMetrics company={company} />
      </section>
      <Tabs
        value={tab}
        onChange={setTab}
        label="Сведения компании"
        items={[
          { value: "info", label: "О компании" },
          { value: "bank", label: "Реквизиты" },
          { value: "documents", label: "Документы" },
        ]}
      />
      {tab === "info" && (
        <div className="company-columns">
          <section className="panel company-section">
            <h3>Сведения о компании</h3>
            <div className="company-group">
              <ReadData
                rows={[
                  { label: "Название", value: company.name, wide: true },
                  { label: "ИНН", value: company.inn },
                  {
                    label: "Дата регистрации",
                    value: company.details.registered_on,
                  },
                  {
                    label: "Руководитель",
                    value: company.details.director,
                    wide: true,
                  },
                ]}
              />
            </div>
            <div className="company-group">
              <h4>Деятельность</h4>
              <ReadData
                rows={[
                  {
                    label: `ОКВЭД ${company.okved.code}`,
                    value: company.okved.name,
                    wide: true,
                  },
                  {
                    label: "Просрочки",
                    value: company.has_overdue
                      ? "Есть просроченные обязательства"
                      : "Нет",
                  },
                ]}
              />
            </div>
            <details className="company-group">
              <summary className="text-link">Дополнительные реквизиты</summary>
              <div style={{ paddingTop: 18 }}>
                <ReadData
                  rows={[
                    {
                      label: "Полное наименование",
                      value: company.details.full_name || company.name,
                      wide: true,
                    },
                    { label: "КПП", value: company.details.kpp },
                    {
                      label: company.legal_form === "IP" ? "ОГРНИП" : "ОГРН",
                      value: company.ogrn,
                    },
                  ]}
                />
              </div>
            </details>
            <div className="company-group">
              <h4>Адреса</h4>
              <ReadData
                rows={[
                  {
                    label: "Юридический адрес",
                    value: company.details.legal_address,
                    wide: true,
                  },
                  {
                    label: "Фактический адрес",
                    value: company.details.actual_address,
                    wide: true,
                  },
                ]}
              />
            </div>
          </section>
          <aside className="panel company-section">
            <h3>Контактное лицо</h3>
            <div className="company-contact">
              <span className="user-avatar">{initials(user.full_name)}</span>
              <div>
                <strong>{user.full_name}</strong>
                <small>Представитель компании</small>
              </div>
            </div>
            <ReadData
              rows={[
                { label: "Email", value: user.email, wide: true },
                { label: "Телефон", value: company.details.phone, wide: true },
              ]}
            />
            <div className="section-divider" />
            <p className="fine-print">
              Сведения компании используются при оценке заявки. Проверьте их
              перед отправкой.
            </p>
          </aside>
        </div>
      )}
      {tab === "bank" && (
        <section className="panel company-section">
          <div className="spread">
            <h3>Банковские реквизиты</h3>
            <Button
              variant="ghost"
              className="text-link"
              onClick={() => setEditing(true)}
            >
              Изменить
              <Pencil size={14} />
            </Button>
          </div>
          <ReadData
            rows={bankFields.map((field) => ({
              label: field.label,
              value: company.details[field.key],
              wide: field.wide,
            }))}
          />
        </section>
      )}
      {tab === "documents" && (
        <section className="panel company-section">
          <h3>Документы компании</h3>
          <p className="fine-print">
            Храним актуальные версии. Перед оценкой попросим подтвердить, что
            данные не изменились.
          </p>
          <DocumentList
            documents={documents}
            editable
            onUpdated={() => useCabinet.getState().refresh("client", true)}
          />
        </section>
      )}
      <footer className="company-footer">
        <p className="fine-print">
          Финансовые показатели указаны компанией. При оценке система сверяет их
          с доступными источниками.
        </p>
        <Button variant="ghost" busy={loggingOut} onClick={() => void logout()}>
          <LogOut size={16} />
          Выйти из кабинета
        </Button>
      </footer>
    </>
  );
}
