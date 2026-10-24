"use client";
import { useCabinet } from "@/entities/cabinet/model/store";
import { LoanWizard } from "@/widgets/loan-wizard";
import { Alert, Loading } from "@/shared/ui";
import { PageHeader } from "@/widgets/app-shell";
export function NewApplicationScreen() {
  const { products, ready, error } = useCabinet();
  return (
    <>
      <PageHeader
        title="Новая заявка"
        subtitle="Укажите цель, выберите продукт, сумму и срок."
      />
      {!ready ? (
        error ? null : (
          <Loading />
        )
      ) : products.length ? (
        <LoanWizard products={products} />
      ) : (
        <Alert>Пока нет доступных кредитных продуктов</Alert>
      )}
    </>
  );
}
