"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, FileCheck2, Trash2 } from "lucide-react";
import { useCabinet } from "@/entities/cabinet/model/store";
import { useSession } from "@/entities/session/model/store";
import { ReadData } from "@/entities/cabinet/ui";
import { DocumentList } from "@/features/documents/ui/documents";
import type {
  ApplicationDetail,
  LoanValues,
  Product,
} from "@/shared/api/contracts";
import { api, errorMessage, jsonBody } from "@/shared/api/client";
import { compactMoney, money } from "@/shared/lib/format";
import { Alert, Button, Modal, Textarea } from "@/shared/ui";
import { loanSchema } from "@/features/loan/model/schema";
import { useLoanFlow } from "@/features/loan/model/store";
import { Calculation } from "@/features/loan/ui/calculation";

export function LoanWizard({
  draft,
  products,
}: {
  draft?: ApplicationDetail;
  products: Product[];
}) {
  const router = useRouter();
  const user = useSession((state) => state.user);
  const documents = useCabinet((state) => state.documents);
  const [step, setStepState] = useState(
    draft ? (useLoanFlow.getState().steps[draft.id] ?? 1) : 1,
  );
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >(draft ? "saved" : "idle");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletedId, setDeletedId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(draft?.id ?? null);
  const activeId = useRef<number | null>(draft?.id ?? null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const lastSaved = useRef(
    draft
      ? JSON.stringify({
          purpose: draft.purpose,
          product_id: draft.product.id,
          amount: draft.amount,
          term_months: draft.term_months,
        })
      : "",
  );
  const alive = useRef(true);
  const stopped = useRef(false);
  const schema = useMemo(() => loanSchema(products), [products]);
  const first = products[0];
  const {
    register,
    control,
    getValues,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<LoanValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      purpose: draft?.purpose ?? "",
      product_id: draft?.product.id ?? first.id,
      amount:
        draft?.amount ??
        Math.min(first.max_amount, Math.max(first.min_amount, 1200000)),
      term_months:
        draft?.term_months ??
        Math.min(first.max_term_months, Math.max(first.min_term_months, 12)),
    },
  });
  const values = useWatch({ control }) as LoanValues;
  const product = products.find((p) => p.id === values.product_id) ?? first;
  const save = useCallback(
    (snapshot: LoanValues) => {
      const parsed = schema.safeParse(snapshot);
      if (!parsed.success || deletedId || stopped.current)
        return Promise.resolve(null);
      const normalized = parsed.data;
      const key = JSON.stringify(normalized);
      const operation = queue.current
        .catch(() => undefined)
        .then(async () => {
          if (stopped.current) return activeId.current;
          if (key === lastSaved.current && activeId.current)
            return activeId.current;
          if (alive.current) setSaveState("saving");
          const id = activeId.current;
          const record = await api<ApplicationDetail>(
            id ? `/applications/${id}` : "/applications",
            { method: id ? "PUT" : "POST", body: jsonBody(normalized) },
          );
          activeId.current = record.id;
          lastSaved.current = key;
          if (alive.current) {
            setSaveState("saved");
            setSavedId(record.id);
            useLoanFlow.getState().setStep(record.id, step);
          }
          return record.id;
        });
      queue.current = operation;
      return operation.catch((cause) => {
        if (alive.current) {
          setSaveState("error");
          setError(errorMessage(cause));
        }
        throw cause;
      });
    },
    [schema, deletedId, step],
  );
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  const ownerId = user?.id;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!stopped.current && useSession.getState().user?.id === ownerId) {
        void saveRef
          .current(getValues())
          .then((id) => {
            if (id) return useCabinet.getState().refresh("client", true);
          })
          .catch(() => undefined);
      }
    };
  }, [getValues, ownerId]);
  useEffect(() => {
    if (deletedId || !schema.safeParse(values).success) return;
    const timer = setTimeout(() => {
      void save(values).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [values, schema, save, deletedId]);
  function go(next: number) {
    setStepState(next);
    setAgreed(false);
    if (activeId.current)
      useLoanFlow.getState().setStep(activeId.current, next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function advance() {
    if (!(await trigger())) return;
    setBusy(true);
    setError("");
    try {
      const id = await save(getValues());
      if (id) go(2);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  async function confirmDocuments() {
    setBusy(true);
    setError("");
    try {
      const id = await save(getValues());
      if (!id) return;
      await api(`/applications/${id}/documents/confirm`, {
        method: "POST",
        body: jsonBody({ document_ids: documents.map((doc) => doc.id) }),
      });
      go(3);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!agreed) return;
    setBusy(true);
    setError("");
    try {
      const id = await save(getValues());
      if (!id) return;
      stopped.current = true;
      await api<ApplicationDetail>(`/applications/${id}/submit`, {
        method: "POST",
      });
      await useCabinet.getState().refresh("client", true);
      router.replace(`/applications/${id}`);
    } catch (cause) {
      stopped.current = false;
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    stopped.current = true;
    try {
      await queue.current.catch(() => undefined);
      const id = activeId.current;
      if (id) {
        await api(`/applications/${id}`, { method: "DELETE" });
        setDeletedId(id);
        await useCabinet.getState().refresh("client", true);
      }
      setDeleteOpen(false);
    } catch (cause) {
      stopped.current = false;
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  function selectProduct(selected: Product) {
    setValue("product_id", selected.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(
      "amount",
      Math.min(
        selected.max_amount,
        Math.max(selected.min_amount, getValues("amount")),
      ),
      { shouldDirty: true, shouldValidate: true },
    );
    setValue(
      "term_months",
      Math.min(
        selected.max_term_months,
        Math.max(selected.min_term_months, getValues("term_months")),
      ),
      { shouldDirty: true, shouldValidate: true },
    );
  }
  if (deletedId)
    return (
      <div className="panel empty">
        <h2>Черновик удалён</h2>
        <p className="muted">Можно восстановить его и продолжить заполнение.</p>
        {error && <Alert>{error}</Alert>}
        <div
          className="row"
          style={{ justifyContent: "center", flexWrap: "wrap" }}
        >
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/applications/${deletedId}/restore`, {
                  method: "POST",
                });
                stopped.current = false;
                setDeletedId(null);
                await useCabinet.getState().refresh("client", true);
              } catch (cause) {
                setError(errorMessage(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            Восстановить
          </Button>
          <Button variant="primary" onClick={() => router.push("/dashboard")}>
            На главную
          </Button>
        </div>
      </div>
    );
  const terms = [
    ...new Set([
      product.min_term_months,
      6,
      12,
      24,
      36,
      48,
      60,
      product.max_term_months,
      values.term_months,
    ]),
  ]
    .filter(
      (term) =>
        term >= product.min_term_months && term <= product.max_term_months,
    )
    .sort((a, b) => a - b);
  return (
    <div className="wizard">
      <div className="stepper" aria-label="Этапы заявки">
        {["Параметры", "Документы", "Проверка"].map((title, index) => (
          <div
            key={title}
            className={`step-item ${step === index + 1 ? "active" : step > index + 1 ? "done" : ""}`}
            aria-current={step === index + 1 ? "step" : undefined}
          >
            <span className="step-circle">
              {step > index + 1 ? <Check size={14} /> : index + 1}
            </span>
            <span>{title}</span>
          </div>
        ))}
      </div>
      {error && (
        <Alert
          action={
            <Button variant="ghost" onClick={() => setError("")}>
              Закрыть
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      <section className="panel wizard-panel">
        {step === 1 && (
          <>
            <div className="question">
              <label className="question-title" htmlFor="loan-purpose">
                <span className="question-number">1</span>На что нужны деньги?
              </label>
              <Textarea
                id="loan-purpose"
                placeholder="Например, купить оборудование для производства"
                maxLength={1000}
                aria-invalid={!!errors.purpose}
                {...register("purpose")}
              />
              <div className="spread">
                <span className="field-error">{errors.purpose?.message}</span>
                <span className="counter">
                  {values.purpose?.length ?? 0}/1000
                </span>
              </div>
            </div>
            <fieldset className="question">
              <legend className="question-title">
                <span className="question-number">2</span>Выберите продукт
              </legend>
              <div className="product-grid">
                {products.map((item) => (
                  <label key={item.id} className="product-choice">
                    <input
                      type="radio"
                      name="loan-product"
                      value={item.id}
                      checked={values.product_id === item.id}
                      onChange={() => selectProduct(item)}
                    />
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    <span className="product-limit">
                      до {compactMoney(item.max_amount)}
                    </span>
                    <small>
                      до {item.max_term_months} мес. · от {item.base_rate}%
                    </small>
                    <small>
                      {item.collateral_required
                        ? "С обеспечением"
                        : "Без залога"}
                    </small>
                  </label>
                ))}
              </div>
              {errors.product_id && (
                <p className="field-error">{errors.product_id.message}</p>
              )}
            </fieldset>
            <div className="question">
              <label className="question-title" htmlFor="loan-amount">
                <span className="question-number">3</span>Какая сумма нужна?
              </label>
              <div className="amount-field">
                <input
                  id="loan-amount"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={product.min_amount}
                  max={product.max_amount}
                  step={1000}
                  aria-invalid={!!errors.amount}
                  {...register("amount", { valueAsNumber: true })}
                />
                <span>₽</span>
              </div>
              <input
                className="range"
                type="range"
                aria-label="Сумма финансирования"
                aria-valuetext={money(values.amount || product.min_amount)}
                min={product.min_amount}
                max={product.max_amount}
                step={1000}
                value={Math.min(
                  product.max_amount,
                  Math.max(
                    product.min_amount,
                    values.amount || product.min_amount,
                  ),
                )}
                onChange={(event) =>
                  setValue("amount", Number(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <div className="range-labels">
                <span>{compactMoney(product.min_amount)}</span>
                <span>{compactMoney(product.max_amount)}</span>
              </div>
              {errors.amount && (
                <p className="field-error">{errors.amount.message}</p>
              )}
            </div>
            <fieldset className="question">
              <legend className="question-title">
                <span className="question-number">4</span>На какой срок?
              </legend>
              <div className="term-options">
                {terms.map((term) => (
                  <button
                    key={term}
                    type="button"
                    aria-pressed={values.term_months === term}
                    onClick={() =>
                      setValue("term_months", term, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    {term} мес.
                  </button>
                ))}
              </div>
              {errors.term_months && (
                <p className="field-error">{errors.term_months.message}</p>
              )}
            </fieldset>
            <Calculation
              amount={Number.isFinite(values.amount) ? values.amount : 0}
              months={values.term_months}
              product={product}
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2>Документы компании</h2>
            <p className="muted">Проверьте документы перед отправкой заявки.</p>
            <DocumentList
              documents={documents}
              editable
              onUpdated={async () => {
                setAgreed(false);
                await useCabinet.getState().refresh("client", true);
              }}
            />
            <div className="document-confirmation">
              <h3>Документы компании актуальны?</h3>
              <p>Если сведения изменились, замените нужные файлы выше.</p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>Подтверждаю, что перечисленные документы актуальны</span>
              </label>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Проверьте заявку</h2>
            <p className="muted">Всё готово для автоматической оценки.</p>
            <div className="section-divider" />
            <p className="review-purpose">{values.purpose}</p>
            <div className="review-grid">
              <section className="review-section">
                <h3>Параметры финансирования</h3>
                <ReadData
                  rows={[
                    { label: "Продукт", value: product.name, wide: true },
                    { label: "Сумма", value: money(values.amount) },
                    { label: "Срок", value: `${values.term_months} мес.` },
                  ]}
                />
                <Button
                  variant="ghost"
                  className="text-link"
                  onClick={() => go(1)}
                >
                  Изменить параметры
                </Button>
              </section>
              <section className="review-section">
                <h3>Компания и документы</h3>
                <ReadData
                  rows={[
                    {
                      label: "Компания",
                      value: user?.company?.name,
                      wide: true,
                    },
                    { label: "ИНН", value: user?.company?.inn },
                    {
                      label: "Документы",
                      value: `${documents.length} подтверждено`,
                    },
                  ]}
                />
                <Button
                  variant="ghost"
                  className="text-link"
                  onClick={() => go(2)}
                >
                  Проверить документы
                </Button>
              </section>
            </div>
            <Calculation
              amount={values.amount}
              months={values.term_months}
              product={product}
            />
            <label className="checkbox review-confirm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                Подтверждаю сведения и согласен на проверку данных компании
              </span>
            </label>
          </>
        )}
        <footer className="wizard-actions">
          {step > 1 && (
            <Button onClick={() => go(step - 1)} disabled={busy}>
              <ArrowLeft size={16} />
              Назад
            </Button>
          )}
          <span className="save-indicator" role="status">
            {saveState === "saving"
              ? "Сохраняем…"
              : saveState === "saved"
                ? "Черновик сохранён"
                : saveState === "error"
                  ? "Не удалось сохранить"
                  : "Черновик сохранится после указания цели"}
          </span>
          {step === 1 ? (
            <Button
              variant="primary"
              busy={busy}
              onClick={() => void advance()}
            >
              К документам
              <ArrowRight size={16} />
            </Button>
          ) : step === 2 ? (
            <Button
              variant="primary"
              busy={busy}
              disabled={!agreed || documents.length !== 3}
              onClick={() => void confirmDocuments()}
            >
              Продолжить
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              variant="primary"
              busy={busy}
              disabled={!agreed}
              onClick={() => void submit()}
            >
              <FileCheck2 size={17} />
              Получить оценку
            </Button>
          )}
        </footer>
      </section>
      {(savedId || draft) && (
        <div className="spread" style={{ marginTop: 12 }}>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={15} />
            Удалить черновик
          </Button>
          {step === 3 && (
            <span className="fine-print">Демонстрационный режим</span>
          )}
        </div>
      )}
      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!busy) setDeleteOpen(false);
        }}
        title="Удалить черновик?"
      >
        <p className="muted">
          Заявка ещё не отправлена. После удаления её можно восстановить.
        </p>
        <div className="modal-actions">
          <Button disabled={busy} onClick={() => setDeleteOpen(false)}>
            Оставить
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void remove()}>
            Удалить
          </Button>
        </div>
      </Modal>
    </div>
  );
}
