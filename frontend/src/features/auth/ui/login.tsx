"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useSession } from "@/entities/session/model/store";
import { useCabinet } from "@/entities/cabinet/model/store";
import { errorMessage } from "@/shared/api/client";
import {
  Alert,
  BankContact,
  Button,
  Field,
  Input,
  ThemeToggle,
} from "@/shared/ui";

const schema = z.object({
  identifier: z.string().trim().min(1, "Введите логин или ИНН"),
  password: z.string().min(1, "Введите пароль"),
});
type Values = z.infer<typeof schema>;
const demos = [
  {
    email: "client1@example.com",
    name: "ООО «Ромашка»",
    text: "Устойчивый бизнес",
    icon: Building2,
  },
  {
    email: "client2@example.com",
    name: "ИП Иванов",
    text: "Развитие торговли",
    icon: Store,
  },
  {
    email: "client3@example.com",
    name: "ООО «Риск»",
    text: "Компания с просрочками",
    icon: Building2,
  },
  {
    email: "bank@example.com",
    name: "Кабинет банка",
    text: "Проверка заявок",
    icon: ShieldCheck,
  },
];
export function Login({
  brand,
  intro,
}: {
  brand: ReactNode;
  intro: ReactNode;
}) {
  const router = useRouter();
  const { status, user, login } = useSession();
  const [byInn, setByInn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" },
  });
  useEffect(() => {
    if (status === "authenticated" && user)
      router.replace(
        user.role === "bank" ? "/bank/applications" : "/dashboard",
      );
  }, [status, user, router]);
  async function enter(credentials: {
    email?: string;
    inn?: string;
    password: string;
  }) {
    setError("");
    useCabinet.getState().reset();
    try {
      const current = await login(credentials);
      router.replace(
        current.role === "bank" ? "/bank/applications" : "/dashboard",
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return (
    <div className="login-page">
      <header className="login-header">
        {brand}
        <div>
          <BankContact />
          <ThemeToggle />
        </div>
      </header>
      <main className="login-main">
        <section className="login-form">
          <div className="login-intro">{intro}</div>
          <form
            onSubmit={handleSubmit((values) => {
              const identifier = values.identifier.trim();
              if (byInn && !/^(\d{10}|\d{12})$/.test(identifier)) {
                setError("ИНН должен содержать 10 или 12 цифр");
                return;
              }
              if (!byInn && !z.email().safeParse(identifier).success) {
                setError("Введите email, указанный при регистрации");
                return;
              }
              return enter({
                ...(byInn ? { inn: identifier } : { email: identifier }),
                password: values.password,
              });
            })}
            noValidate
          >
            {error && <Alert>{error}</Alert>}
            <Field
              label={byInn ? "ИНН компании" : "Логин"}
              error={errors.identifier?.message}
            >
              <Input
                autoComplete="username"
                inputMode={byInn ? "numeric" : "email"}
                placeholder={byInn ? "10 или 12 цифр" : "name@company.ru"}
                {...register("identifier")}
              />
            </Field>
            <Field label="Пароль" error={errors.password?.message}>
              <span className="password-field">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Введите пароль"
                  {...register("password")}
                />
                <Button
                  variant="ghost"
                  className="icon-btn"
                  aria-label={
                    showPassword ? "Скрыть пароль" : "Показать пароль"
                  }
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </span>
            </Field>
            <Button
              type="submit"
              variant="primary"
              className="full-width"
              busy={isSubmitting}
              disabled={!!demoBusy || status === "loading"}
            >
              Войти
              <ArrowRight size={18} />
            </Button>
          </form>
          <Button
            variant="ghost"
            className="alternate-login"
            onClick={() => {
              setByInn(!byInn);
              setError("");
              reset();
            }}
          >
            {byInn ? "Войти с логином и паролем" : "Войти по ИНН"}
          </Button>
          <div className="demo-heading">
            <span>Демо-аккаунты</span>
          </div>
          <div className="demo-grid">
            {demos.map(({ email, name, text, icon: Icon }) => (
              <button
                className="demo-account"
                key={email}
                disabled={!!demoBusy || isSubmitting || status === "loading"}
                onClick={async () => {
                  setDemoBusy(email);
                  await enter({ email, password: "password123" });
                  setDemoBusy(null);
                }}
              >
                <span className="square-icon">
                  <Icon size={21} />
                </span>
                <span>
                  <strong>{demoBusy === email ? "Входим…" : name}</strong>
                  <small>{text}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <p className="fine-print centered">
            Тестовые данные для знакомства с сервисом
          </p>
        </section>
      </main>
    </div>
  );
}
