"use client";
import Link from "next/link";
import { useCabinet } from "@/entities/cabinet/model/store";
import { ApplicationCard } from "@/entities/cabinet/ui";
import { EmptyState, Loading } from "@/shared/ui";
import { NewApplicationLink, PageHeader } from "@/widgets/app-shell";
export function ApplicationsScreen() {
  const { ready, applications, error } = useCabinet();
  return (
    <>
      <PageHeader
        title="Мои заявки"
        subtitle="Результаты оценки и сохранённые черновики."
        action={<NewApplicationLink />}
      />
      {!ready ? (
        error ? null : (
          <Loading />
        )
      ) : applications.length ? (
        <>
          <div className="request-list">
            {applications.map((application) => (
              <ApplicationCard key={application.id} application={application} />
            ))}
          </div>
          <p className="demo-note">Скор рассчитан в демонстрационном режиме</p>
        </>
      ) : (
        <EmptyState
          title="Заявок пока нет"
          action={
            <Link className="btn btn-primary" href="/applications/new">
              Заполнить заявку
            </Link>
          }
        >
          Начните с цели, суммы и срока. Черновик сохранится автоматически.
        </EmptyState>
      )}
    </>
  );
}
