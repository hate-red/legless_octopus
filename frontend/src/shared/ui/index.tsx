"use client";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle,
  Check,
  LoaderCircle,
  Moon,
  Phone,
  Sun,
  X,
} from "lucide-react";
import { usePreferences } from "@/shared/model/preferences";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    busy?: boolean;
  }
>(function Button(
  {
    variant = "secondary",
    busy,
    className = "",
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy && <LoaderCircle className="spin" size={17} />}
      {children}
    </button>
  );
});
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`input ${className}`} {...props} />;
});
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea ref={ref} className={`input textarea ${className}`} {...props} />
  );
});
export function Field({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
export function Alert({
  children,
  action,
  tone = "error",
}: {
  children: ReactNode;
  action?: ReactNode;
  tone?: "error" | "info" | "success";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`alert alert-${tone}`}
    >
      <AlertCircle size={18} />
      <div>{children}</div>
      {action}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={(event) => {
        if (event.target === event.currentTarget && open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <Button
        variant="ghost"
        className="icon-btn modal-close"
        aria-label="Закрыть"
        onClick={onClose}
      >
        <X size={22} />
      </Button>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
export function ThemeToggle() {
  const { theme, toggleTheme } = usePreferences();
  return (
    <Button
      className="icon-btn"
      variant="ghost"
      onClick={toggleTheme}
      aria-label={
        theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
      }
    >
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </Button>
  );
}
export function BankContact({
  support = false,
  trigger,
}: {
  support?: boolean;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={support ? "support-trigger" : "call-trigger"}
        aria-label={support ? "Помощь" : "Позвонить в банк"}
        onClick={() => setOpen(true)}
      >
        {trigger ?? (
          <>
            <Phone size={17} />
            Позвонить в банк
          </>
        )}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={support ? "Поддержка" : "Позвонить в банк"}
        eyebrow="Бизнес-кабинет"
      >
        <p className="muted">Поможем с заявкой и документами.</p>
        <div className="contact-row">
          <span className="square-icon">
            <Phone size={22} />
          </span>
          <div>
            <span className="muted">Контакт для демонстрации</span>
            <a className="contact-phone" href="tel:88001007733">
              8 800 100-77-33
            </a>
          </div>
        </div>
        <p className="fine-print">
          В рабочей версии здесь будут контакты вашего банка.
        </p>
      </Modal>
    </>
  );
}
export function Loading({ label = "Загружаем данные…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel empty">
      <span className="empty-symbol">
        <Check size={24} />
      </span>
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          tabIndex={value === item.value ? 0 : -1}
          aria-selected={value === item.value}
          className={value === item.value ? "active" : ""}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        items.length) %
                      items.length;
              onChange(items[next].value);
              (
                event.currentTarget.parentElement?.children[next] as HTMLElement
              ).focus();
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
