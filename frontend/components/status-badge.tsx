import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { statusLabel } from "@/lib/format";
import type { ApplicationStatus } from "@/lib/types";

export const statusChipClasses: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  VALIDATION: "bg-sky-50 text-sky-700",
  ENRICHMENT: "bg-sky-50 text-sky-700",
  AI_PURPOSE_CHECK: "bg-violet-50 text-violet-700",
  SCORING: "bg-indigo-50 text-indigo-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  COUNTER_OFFER: "bg-amber-50 text-amber-800",
  MANUAL_REVIEW: "bg-purple-50 text-purple-700",
  REJECTED: "bg-red-50 text-red-700",
  CONTRACT_SIGNING: "bg-blue-50 text-blue-700",
  DISBURSED: "bg-emerald-600 text-white",
};

export const statusDotClasses: Record<string, string> = {
  DRAFT: "bg-ink-400",
  VALIDATION: "bg-sky-500",
  ENRICHMENT: "bg-sky-500",
  AI_PURPOSE_CHECK: "bg-violet-500",
  SCORING: "bg-indigo-500",
  APPROVED: "bg-emerald-500",
  COUNTER_OFFER: "bg-amber-500",
  MANUAL_REVIEW: "bg-purple-500",
  REJECTED: "bg-red-500",
  CONTRACT_SIGNING: "bg-blue-500",
  DISBURSED: "bg-emerald-500",
};

const inProgress = new Set<ApplicationStatus>([
  "VALIDATION",
  "ENRICHMENT",
  "AI_PURPOSE_CHECK",
  "SCORING",
]);

export function StatusBadge({
  status,
  className,
  showSpinner = true,
}: {
  status: string;
  className?: string;
  showSpinner?: boolean;
}) {
  const isProcessing = inProgress.has(status as ApplicationStatus);
  return (
    <span
      className={cn(
        "chip whitespace-nowrap",
        statusChipClasses[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {isProcessing && showSpinner ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            statusDotClasses[status] ?? "bg-ink-400",
            status === "DISBURSED" && "bg-card",
          )}
        />
      )}
      {statusLabel(status)}
    </span>
  );
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        statusDotClasses[status] ?? "bg-ink-400",
        className,
      )}
    />
  );
}
