"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ApplicationDetail } from "@/shared/api/contracts";
import { api, errorMessage, jsonBody } from "@/shared/api/client";
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  Tabs,
  Textarea,
} from "@/shared/ui";
function DecisionForm({
  application,
  onUpdated,
  initialDecision,
}: {
  application: ApplicationDetail;
  initialDecision: "APPROVED" | "MANUAL_REVIEW" | "REJECTED";
  onUpdated: (application: ApplicationDetail) => void;
}) {
  const [decision, setDecision] = useState<
    "APPROVED" | "MANUAL_REVIEW" | "REJECTED"
  >(initialDecision);
  const [error, setError] = useState("");
  const schema = z.object({
    comment: z
      .string()
      .trim()
      .refine(
        (value) => decision === "APPROVED" || value.length >= 5,
        "Добавьте комментарий: минимум 5 символов",
      )
      .max(2000),
    approved_amount: z
      .number()
      .min(application.product.min_amount)
      .max(application.product.max_amount),
    approved_term_months: z
      .number()
      .int()
      .min(application.product.min_term_months)
      .max(application.product.max_term_months),
    approved_rate: z
      .number({ error: "Укажите ставку" })
      .positive("Ставка должна быть больше нуля")
      .max(100, "Не более 100%"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      comment: "",
      approved_amount: application.amount,
      approved_term_months: application.term_months,
      approved_rate: application.product.base_rate,
    },
  });
  return (
    <section className="panel panel-padding">
      <h3>Решение по заявке</h3>
      <form
        className="decision-form"
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            const { comment, ...conditions } = values;
            const result = await api<ApplicationDetail>(
              `/bank/applications/${application.id}/decision`,
              {
                method: "POST",
                body: jsonBody({
                  decision,
                  comment,
                  ...(decision === "APPROVED" ? conditions : {}),
                }),
              },
            );
            onUpdated(result);
          } catch (cause) {
            setError(errorMessage(cause));
          }
        })}
      >
        <Tabs
          value={decision}
          onChange={setDecision}
          label="Решение банка"
          items={[
            { value: "APPROVED", label: "Одобрить" },
            { value: "MANUAL_REVIEW", label: "Запросить данные" },
            { value: "REJECTED", label: "Отказать" },
          ]}
        />
        {error && <Alert>{error}</Alert>}
        {decision === "APPROVED" && (
          <div className="form-grid" style={{ marginBottom: 22 }}>
            <Field
              label="Одобренная сумма, ₽"
              error={errors.approved_amount?.message}
            >
              <Input
                type="number"
                {...register("approved_amount", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Срок, месяцев"
              error={errors.approved_term_months?.message}
            >
              <Input
                type="number"
                {...register("approved_term_months", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Ставка, %" error={errors.approved_rate?.message}>
              <Input
                type="number"
                step="0.1"
                {...register("approved_rate", { valueAsNumber: true })}
              />
            </Field>
          </div>
        )}
        <Field
          label={
            decision === "MANUAL_REVIEW"
              ? "Какие данные нужно уточнить?"
              : "Комментарий для клиента"
          }
          error={errors.comment?.message}
        >
          <Textarea
            {...register("comment")}
            placeholder="Объясните решение простыми словами"
          />
        </Field>
        <Button variant="primary" type="submit" busy={isSubmitting}>
          {decision === "APPROVED"
            ? "Одобрить заявку"
            : decision === "MANUAL_REVIEW"
              ? "Отправить запрос"
              : "Подтвердить отказ"}
        </Button>
      </form>
    </section>
  );
}

export function BankDecision({
  application,
  onUpdated,
}: {
  application: ApplicationDetail;
  onUpdated: (application: ApplicationDetail) => void;
}) {
  const [action, setAction] = useState<
    "APPROVED" | "MANUAL_REVIEW" | "REJECTED" | null
  >(null);
  return (
    <>
      <section className="panel bank-decision-actions">
        <h3>Что делаем дальше?</h3>
        <p className="fine-print">
          Изучите данные и выберите действие по заявке.
        </p>
        <Button variant="primary" onClick={() => setAction("APPROVED")}>
          Одобрить
        </Button>
        <Button onClick={() => setAction("MANUAL_REVIEW")}>
          Запросить документы
        </Button>
        <Button variant="danger" onClick={() => setAction("REJECTED")}>
          Отказать
        </Button>
        <p className="fine-print bank-decision-note">
          Для запроса документов и отказа нужно пояснение. При одобрении можно
          изменить условия.
        </p>
      </section>
      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title="Решение по заявке"
        className="decision-modal"
      >
        {action && (
          <DecisionForm
            key={action}
            application={application}
            initialDecision={action}
            onUpdated={(updated) => {
              onUpdated(updated);
              setAction(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}
