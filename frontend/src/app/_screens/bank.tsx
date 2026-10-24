"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LogOut, RefreshCw } from "lucide-react";
import { useCabinet } from "@/entities/cabinet/model/store";
import { useSession } from "@/entities/session/model/store";
import { ReadData, StatusBadge } from "@/entities/cabinet/ui";
import type { Application } from "@/shared/api/contracts";
import { api, errorMessage } from "@/shared/api/client";
import { dateTime, initials, money, statusLabels } from "@/shared/lib/format";
import { Alert, Button, EmptyState, Loading } from "@/shared/ui";
import { PageHeader, SearchField } from "@/widgets/app-shell";

export function BankScreen({ decisions = false }: { decisions?: boolean }) {
  const { applications, ready, products } = useCabinet();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [rows, setRows] = useState<Application[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        const query = new URLSearchParams({ limit: "100" });
        if (search.trim()) query.set("search", search.trim());
        if (status) query.set("status", status);
        if (product) query.set("product_code", product);
        try {
          const result = await api<Application[]>(
            `/bank/applications?${query}`,
            { signal: controller.signal },
          );
          setRows(result);
          setError("");
        } catch (cause) {
          if (!controller.signal.aborted) setError(errorMessage(cause));
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      search ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, product, revision, applications]);
  const filtered = (rows ?? applications).filter((app) =>
    decisions
      ? [
          "APPROVED",
          "REJECTED",
          "COUNTER_OFFER",
          "CONTRACT_SIGNING",
          "DISBURSED",
        ].includes(app.status)
      : true,
  );
  return (
    <>
      <PageHeader
        title={decisions ? "Решения по заявкам" : "Заявки клиентов"}
        subtitle={
          decisions
            ? "Результаты оценки и принятые решения."
            : "Оценка системы и заявки, которым нужно ваше внимание."
        }
        action={
          <Button
            onClick={() => {
              void useCabinet.getState().refresh("bank", true);
              setRevision((value) => value + 1);
            }}
          >
            <RefreshCw size={16} />
            Обновить
          </Button>
        }
      />
      <div className="queue-shortcuts">
        <Button
          variant={!status ? "primary" : "secondary"}
          onClick={() => setStatus("")}
        >
          Все <span>{applications.length}</span>
        </Button>
        <Button
          variant={status === "MANUAL_REVIEW" ? "primary" : "secondary"}
          onClick={() => setStatus("MANUAL_REVIEW")}
        >
          На проверке{" "}
          <span>
            {
              applications.filter((app) => app.status === "MANUAL_REVIEW")
                .length
            }
          </span>
        </Button>
        <Button
          variant={status === "APPROVED" ? "primary" : "secondary"}
          onClick={() => setStatus("APPROVED")}
        >
          Одобрено{" "}
          <span>
            {applications.filter((app) => app.status === "APPROVED").length}
          </span>
        </Button>
      </div>
      <div className="queue-toolbar">
        <SearchField value={search} onChange={setSearch} />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Статус заявки"
        >
          <option value="">Все статусы</option>
          {Object.entries(statusLabels)
            .filter(([value]) => value !== "DRAFT")
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
        <select
          value={product}
          onChange={(event) => setProduct(event.target.value)}
          aria-label="Кредитный продукт"
        >
          <option value="">Все продукты</option>
          {products.map((item) => (
            <option key={item.id} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <Alert
          action={
            <Button onClick={() => setRevision((value) => value + 1)}>
              Повторить
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {!ready || loading ? (
        <Loading />
      ) : filtered.length ? (
        <>
          <div className="panel bank-queue">
            <div className="bank-queue-heading">
              <span>Компания и цель</span>
              <span>Сумма и срок</span>
              <span>Статус</span>
              <span>Скор</span>
              <span />
            </div>
            {filtered.map((application) => (
              <Link
                className="bank-queue-row"
                key={application.id}
                href={`/bank/applications/${application.id}`}
                aria-label={`Открыть заявку № ${application.id}`}
              >
                <div className="bank-queue-company">
                  <span className="company-avatar">
                    {initials(
                      application.client.company?.name ??
                        application.client.full_name,
                    )}
                  </span>
                  <div>
                    <strong>{application.client.company?.name}</strong>
                    <p>{application.purpose}</p>
                    <small>
                      № {application.id} · {dateTime(application.created_at)}
                    </small>
                  </div>
                </div>
                <div className="bank-queue-amount">
                  <strong>{money(application.amount)}</strong>
                  <small>{application.term_months} мес.</small>
                </div>
                <StatusBadge status={application.status} />
                <strong
                  className="bank-queue-score"
                  aria-label={`Скор ${application.score ?? "ещё не рассчитан"}`}
                >
                  {application.score ?? "—"}
                  <small>/100</small>
                </strong>
                <ChevronRight size={17} />
              </Link>
            ))}
          </div>
          <p className="fine-print" style={{ marginTop: 18 }}>
            Показано {filtered.length} последних заявок. Для поиска используйте
            компанию, ИНН или номер.
          </p>
        </>
      ) : (
        <EmptyState title="Заявок не найдено">
          Попробуйте изменить фильтры.
        </EmptyState>
      )}
    </>
  );
}
export function BankProfileScreen() {
  const user = useSession((state) => state.user);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <PageHeader
        title="Профиль сотрудника"
        subtitle="Доступ к кабинету банка."
      />
      <section className="panel panel-padding">
        <ReadData
          rows={[
            { label: "Имя", value: user?.full_name },
            { label: "Email", value: user?.email },
            { label: "Роль", value: "Сотрудник банка" },
          ]}
        />
        {error && <Alert>{error}</Alert>}
        <div className="section-divider" />
        <Button
          onClick={async () => {
            try {
              await useSession.getState().logout();
              useCabinet.getState().reset();
              router.replace("/login");
            } catch (cause) {
              setError(errorMessage(cause));
            }
          }}
        >
          <LogOut size={17} />
          Выйти из кабинета
        </Button>
      </section>
    </>
  );
}
