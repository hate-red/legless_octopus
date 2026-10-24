"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CheckCheck,
  CircleHelp,
  Files,
  Home,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "@/entities/session/model/store";
import { useCabinet } from "@/entities/cabinet/model/store";
import { usePreferences } from "@/shared/model/preferences";
import { dateTime, initials } from "@/shared/lib/format";
import { Alert, BankContact, Button, Loading, ThemeToggle } from "@/shared/ui";

const clientLinks = [
  { href: "/dashboard", label: "Главная", icon: Home },
  { href: "/applications", label: "Мои заявки", icon: Files },
  { href: "/profile", label: "Компания", icon: Building2 },
];
const bankLinks = [
  { href: "/bank/applications", label: "Заявки клиентов", icon: Files },
  { href: "/bank/decisions", label: "Решения", icon: ShieldCheck },
];
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <span className="logo-letter" aria-hidden="true">
        А
      </span>
      {!compact && (
        <span className="logo-word">
          Альфа<small>для бизнеса</small>
        </span>
      )}
      <span className="sr-only">Альфа для бизнеса</span>
    </span>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const cabinet = useCabinet();
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  const [compactScreen, setCompactScreen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteError, setNoteError] = useState("");
  const notesRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = sidebarCollapsed ?? compactScreen;
  const bank = user?.role === "bank";
  const links = bank ? bankLinks : clientLinks;
  useEffect(() => {
    const media = matchMedia("(max-width: 1000px)");
    const sync = () => setCompactScreen(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (status === "authenticated" && user) {
      if (user.role === "bank" && !pathname.startsWith("/bank"))
        router.replace("/bank/applications");
      if (user.role === "client" && pathname.startsWith("/bank"))
        router.replace("/dashboard");
    }
  }, [status, user, pathname, router]);
  useEffect(() => {
    if (!user) return;
    void useCabinet.getState().refresh(user.role);
    const timer = setInterval(() => {
      if (!document.hidden) void useCabinet.getState().refresh(user.role, true);
    }, 15000);
    return () => clearInterval(timer);
  }, [user]);
  useEffect(() => {
    if (!notesOpen) return;
    const close = (event: PointerEvent) => {
      if (!notesRef.current?.contains(event.target as Node))
        setNotesOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotesOpen(false);
        notesRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [notesOpen]);
  if (status !== "authenticated" || !user)
    return (
      <div className="boot">
        <Logo />
        <Loading label="Открываем кабинет…" />
      </div>
    );
  const unread = cabinet.notifications.filter((note) => !note.read).length;
  const mark = async (ids: number[]) => {
    try {
      await cabinet.readNotifications(ids);
      setNoteError("");
    } catch {
      setNoteError("Не удалось отметить уведомления. Попробуйте ещё раз.");
    }
  };
  return (
    <div className={`workspace ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Основное меню">
        <div className="sidebar-brand">
          <Link
            href={bank ? "/bank/applications" : "/dashboard"}
            aria-label="На главную"
          >
            <Logo compact={collapsed} />
          </Link>
          {!collapsed && (
            <Button
              className="icon-btn collapse-button"
              variant="ghost"
              aria-label="Свернуть меню"
              onClick={() => setSidebarCollapsed(true)}
            >
              <PanelLeftClose size={18} />
            </Button>
          )}
        </div>
        <div className="side-content">
          <p className="nav-caption">
            {bank ? "Кабинет банка" : "Кредитный кабинет"}
          </p>
          <nav className="navigation">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                aria-current={
                  pathname === href || pathname.startsWith(`${href}/`)
                    ? "page"
                    : undefined
                }
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="side-bottom">
            <BankContact
              support
              trigger={
                <>
                  <CircleHelp size={23} />
                  <span>Помощь</span>
                </>
              }
            />
            <p className="secure">
              <LockKeyhole size={16} />
              <span>Защищённый кабинет</span>
            </p>
          </div>
        </div>
      </aside>
      <header className="topbar">
        <div className="topbar-start">
          {collapsed && (
            <Button
              variant="ghost"
              className="icon-btn expand-button"
              aria-label="Развернуть меню"
              onClick={() => setSidebarCollapsed(false)}
            >
              <PanelLeftOpen size={19} />
            </Button>
          )}
          <Link
            href={bank ? "/bank/applications" : "/profile"}
            className="company-plate"
          >
            <span className="company-avatar">
              {bank ? (
                <ShieldCheck size={21} />
              ) : (
                initials(user.company?.name ?? user.full_name)
              )}
            </span>
            <span>
              <strong>{bank ? "Кабинет банка" : user.company?.name}</strong>
              <small>
                {bank ? "Работа с заявками" : `ИНН ${user.company?.inn ?? "—"}`}
              </small>
            </span>
          </Link>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <div className="notifications" ref={notesRef}>
            <Button
              variant="ghost"
              className="icon-btn notification-toggle"
              aria-label={`Уведомления${unread ? `: ${unread} непрочитанных` : ""}`}
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen(!notesOpen)}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </Button>
            {notesOpen && (
              <section
                className="notification-popover"
                aria-label="Уведомления"
              >
                <header>
                  <h2>Уведомления</h2>
                  {unread > 0 && (
                    <Button
                      variant="ghost"
                      className="icon-btn"
                      aria-label="Прочитать все"
                      onClick={() =>
                        void mark(
                          cabinet.notifications
                            .filter((n) => !n.read)
                            .map((n) => n.id),
                        )
                      }
                    >
                      <CheckCheck size={19} />
                    </Button>
                  )}
                </header>
                {noteError && <Alert>{noteError}</Alert>}
                <div className="notification-list">
                  {cabinet.notifications.length ? (
                    cabinet.notifications.map((note) => (
                      <Link
                        className={note.read ? "" : "unread"}
                        key={note.id}
                        href={`${bank ? "/bank" : ""}/applications/${note.application_id}`}
                        onClick={() => {
                          void mark([note.id]);
                          setNotesOpen(false);
                        }}
                      >
                        <strong>{note.title}</strong>
                        <span>{note.message}</span>
                        <time>{dateTime(note.created_at)}</time>
                      </Link>
                    ))
                  ) : (
                    <p className="muted empty-notes">
                      Пока нет новых уведомлений
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
          <Link
            href={bank ? "/bank/profile" : "/profile"}
            className="user-avatar"
            aria-label="Профиль пользователя"
          >
            {initials(user.full_name)}
          </Link>
        </div>
      </header>
      <nav className="mobile-navigation" aria-label="Основное меню на телефоне">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <BankContact
          support
          trigger={
            <>
              <CircleHelp size={20} />
              <span>Помощь</span>
            </>
          }
        />
      </nav>
      <main className="main-content">
        {cabinet.error && (
          <Alert
            action={
              <Button onClick={() => void cabinet.refresh(user.role)}>
                Повторить
              </Button>
            }
          >
            {cabinet.error}
          </Alert>
        )}
        {children}
      </main>
    </div>
  );
}
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function NewApplicationLink() {
  return (
    <Link className="btn btn-secondary" href="/applications/new">
      <span className="desktop-label">Новое финансирование</span>
      <span className="mobile-label">Новая заявка</span>
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Компания, ИНН или номер заявки",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-field">
      <Search size={18} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
