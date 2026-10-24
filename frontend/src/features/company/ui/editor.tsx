"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Okved, User } from "@/shared/api/contracts";
import { api, errorMessage, jsonBody } from "@/shared/api/client";
import { Alert, Button, Field, Input } from "@/shared/ui";
const schema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(255),
  inn: z.string().regex(/^(\d{10}|\d{12})$/, "10 или 12 цифр"),
  ogrn: z.string().regex(/^(\d{13}|\d{15})$/, "13 или 15 цифр"),
  okved_id: z.number().int().positive(),
  revenue: z.number().min(0, "Не меньше нуля"),
  declared_profit: z.number(),
  employees: z.number().int().min(0).max(1000000),
  business_age_months: z.number().int().min(0).max(2400),
  contact_name: z.string().trim().min(1, "Укажите контактное лицо").max(255),
  details: z.record(z.string(), z.string().max(500)),
});
type CompanyValues = z.infer<typeof schema>;
const extraFields = [
  { key: "full_name", label: "Полное наименование", wide: true },
  { key: "kpp", label: "КПП" },
  { key: "registered_on", label: "Дата регистрации" },
  { key: "director", label: "Руководитель", wide: true },
  { key: "legal_address", label: "Юридический адрес", wide: true },
  { key: "actual_address", label: "Фактический адрес", wide: true },
];
export const bankFields = [
  { key: "bank", label: "Банк", wide: true },
  { key: "account", label: "Расчётный счёт", wide: true },
  { key: "bik", label: "БИК" },
  { key: "correspondent", label: "Корреспондентский счёт", wide: true },
];
export function CompanyEditor({
  user,
  onSaved,
  onCancel,
}: {
  user: User;
  onSaved: (user: User) => void;
  onCancel: () => void;
}) {
  const company = user.company!;
  const [okveds, setOkveds] = useState<Okved[]>([company.okved]);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    api<Okved[]>("/company/okveds")
      .then((rows) => {
        if (current) setOkveds(rows);
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company.name,
      inn: company.inn,
      ogrn: company.ogrn,
      okved_id: company.okved.id,
      revenue: company.revenue,
      declared_profit: company.declared_profit,
      employees: company.employees,
      business_age_months: company.business_age_months,
      contact_name: user.full_name,
      details: company.details,
    },
  });
  return (
    <section className="panel company-section">
      <h3>Изменить сведения</h3>
      <form
        className="edit-form"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            onSaved(
              await api<User>("/company", {
                method: "PUT",
                body: jsonBody(values),
              }),
            );
          } catch (cause) {
            setError(errorMessage(cause));
          }
        })}
      >
        {error && <Alert>{error}</Alert>}
        <fieldset>
          <legend>Основные сведения</legend>
          <div className="form-grid">
            <Field
              label="Название компании"
              className="wide"
              error={errors.name?.message}
            >
              <Input {...register("name")} />
            </Field>
            <Field label="ИНН" error={errors.inn?.message}>
              <Input inputMode="numeric" {...register("inn")} />
            </Field>
            <Field
              label={company.legal_form === "IP" ? "ОГРНИП" : "ОГРН"}
              error={errors.ogrn?.message}
            >
              <Input inputMode="numeric" {...register("ogrn")} />
            </Field>
            <Field
              label="Основная деятельность"
              className="wide"
              error={errors.okved_id?.message}
            >
              <select
                className="input"
                {...register("okved_id", { valueAsNumber: true })}
              >
                {okveds.map((okved) => (
                  <option key={okved.id} value={okved.id}>
                    {okved.code} · {okved.name}
                  </option>
                ))}
              </select>
            </Field>
            {extraFields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                className={field.wide ? "wide" : ""}
                error={errors.details?.[field.key]?.message}
              >
                <Input {...register(`details.${field.key}`)} maxLength={500} />
              </Field>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Бизнес в цифрах</legend>
          <div className="form-grid">
            <Field
              label="Выручка за последний отчётный год, ₽"
              error={errors.revenue?.message}
            >
              <Input
                type="number"
                step="any"
                {...register("revenue", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Прибыль за год, ₽"
              hint="Может быть отрицательной"
              error={errors.declared_profit?.message}
            >
              <Input
                type="number"
                step="any"
                {...register("declared_profit", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Количество сотрудников"
              error={errors.employees?.message}
            >
              <Input
                type="number"
                min={0}
                {...register("employees", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Возраст компании, месяцев"
              error={errors.business_age_months?.message}
            >
              <Input
                type="number"
                min={0}
                {...register("business_age_months", { valueAsNumber: true })}
              />
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>Банковские реквизиты</legend>
          <div className="form-grid">
            {bankFields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                className={field.wide ? "wide" : ""}
                error={errors.details?.[field.key]?.message}
              >
                <Input {...register(`details.${field.key}`)} maxLength={500} />
              </Field>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Контактное лицо</legend>
          <div className="form-grid">
            <Field label="Имя и фамилия" error={errors.contact_name?.message}>
              <Input {...register("contact_name")} />
            </Field>
            <Field label="Телефон" error={errors.details?.phone?.message}>
              <Input type="tel" {...register("details.phone")} />
            </Field>
            <Field label="Email">
              <Input value={user.email} readOnly />
            </Field>
          </div>
        </fieldset>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button onClick={onCancel} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" busy={isSubmitting}>
            Сохранить изменения
          </Button>
        </div>
      </form>
    </section>
  );
}
