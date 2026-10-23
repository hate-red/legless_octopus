"use client";

import { Check, Clock, X } from "lucide-react";

import { StatusDot } from "@/components/status-badge";
import { cn } from "@/lib/cn";
import { ACTOR_LABELS, formatDateTime, statusLabel } from "@/lib/format";
import type { StatusHistoryItem } from "@/lib/types";

const TERMINAL_SUCCESS = new Set(["APPROVED", "COUNTER_OFFER", "DISBURSED"]);
const TERMINAL_FAIL = new Set(["REJECTED"]);

function TimelineIcon({ status }: { status: string }) {
  if (TERMINAL_SUCCESS.has(status)) {
    return <Check className="h-3 w-3 text-white" />;
  }
  if (TERMINAL_FAIL.has(status)) {
    return <X className="h-3 w-3 text-white" />;
  }
  return <StatusDot status={status} className="h-2 w-2" />;
}

export function StatusTimeline({
  items,
  className,
}: {
  items: StatusHistoryItem[];
  className?: string;
}) {
  if (!items.length) {
    return (
      <div className="text-sm text-muted-foreground">История статусов пока пуста.</div>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const success = TERMINAL_SUCCESS.has(item.status);
        const failure = TERMINAL_FAIL.has(item.status);
        return (
          <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? (
              <span className="absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-px bg-muted" />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card shadow-sm",
                success && "bg-emerald-500",
                failure && "bg-red-500",
                !success && !failure && "bg-muted",
              )}
            >
              <TimelineIcon status={item.status} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {statusLabel(item.status)}
                </div>
                <time className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(item.created_at)}
                </time>
              </div>
              {item.comment ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.comment}
                </p>
              ) : null}
              <div className="mt-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                {ACTOR_LABELS[item.actor_role] ?? item.actor_role}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
