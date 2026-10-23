import { type HTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Button as ShadcnButton,
  buttonVariants,
  type ButtonProps as ShadcnButtonProps,
} from "@/components/ui/button";
import { Card as ShadcnCard } from "@/components/ui/card";
import { Skeleton as ShadcnSkeleton } from "@/components/ui/skeleton";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "dark";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(buttonVariants({ variant, size }), className);
}

export const Button = ShadcnButton;
export type ButtonProps = ShadcnButtonProps;

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <ShadcnCard className={className} {...props} />;
}

interface SectionCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  actions,
  eyebrow,
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <section className={cn("card overflow-hidden", className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          {icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {eyebrow}
              </div>
            ) : null}
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <ShadcnSkeleton className={className} />;
}

export function PageLoader({ label = "Загружаем данные" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-lift">
        А
        <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-alfa-300" />
      </div>
      <div className="flex items-center gap-2 text-base text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function InfoRow({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3", className)}>
      <div className="text-base text-muted-foreground">{label}</div>
      <div className="text-right">
        <div className="text-base font-medium text-foreground">{value}</div>
        {hint ? (
          <div className="mt-0.5 text-sm text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    danger:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  } as const;
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        tones[tone],
        className,
      )}
    >
      {title ? <div className="mb-1 font-semibold">{title}</div> : null}
      <div className="opacity-90">{children}</div>
    </div>
  );
}


