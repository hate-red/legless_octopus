import { cn } from "@/lib/cn";
import { scoreTone } from "@/lib/format";
import type { ScoringFactor } from "@/lib/types";

export function ScoreGauge({
  score,
  size = "md",
  label = "Скор",
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const safeScore = score ?? 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, safeScore));
  const offset = circumference - (progress / 100) * circumference;
  const sizes = {
    sm: "h-20 w-20",
    md: "h-28 w-28",
    lg: "h-36 w-36",
  } as const;
  const textSizes = {
    sm: "text-xl",
    md: "text-3xl",
    lg: "text-4xl",
  } as const;
  const strokeColor =
    score === null || score === undefined
      ? "#d3dae4"
      : safeScore >= 75
        ? "#10b981"
        : safeScore >= 50
          ? "#f59e0b"
          : safeScore >= 30
            ? "#f97316"
            : "#ef4444";

  return (
    <div className={cn("relative shrink-0", sizes[size])}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={score === null || score === undefined ? circumference : offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={cn("font-semibold leading-none", textSizes[size], scoreTone(score))}>
          {score === null || score === undefined ? "—" : score}
        </div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

export function DtiBar({ value }: { value: number | null | undefined }) {
  const dti = value ?? 0;
  const width = Math.min(100, Math.max(0, dti));
  const color =
    dti > 50 ? "bg-red-500" : dti >= 30 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">DTI</span>
        <span
          className={cn(
            "text-sm font-semibold",
            dti > 50
              ? "text-red-600"
              : dti >= 30
                ? "text-amber-600"
                : "text-emerald-600",
          )}
        >
          {value === null || value === undefined
            ? "—"
            : `${dti.toFixed(1).replace(".", ",")}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>30%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function ScoringTable({ factors }: { factors: ScoringFactor[] }) {
  if (!factors.length) {
    return <p className="text-sm text-muted-foreground">Факторы скоринга недоступны.</p>;
  }
  const total = factors.reduce((sum, factor) => sum + factor.points, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-[50%] pb-2 pr-4 font-medium">Фактор</th>
            <th className="w-[32%] pb-2 pr-4 font-medium">Значение</th>
            <th className="w-[18%] pb-2 pr-1 text-right font-medium">Баллы</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {factors.map((factor) => (
            <tr key={factor.factor} className="align-top">
              <td className="py-3 pr-4">
                <div className="font-medium text-foreground">{factor.label}</div>
                <div className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                  {factor.description}
                </div>
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">
                {factor.value}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap py-3 pr-1 text-right font-semibold tabular-nums",
                  factor.points > 0
                    ? "text-emerald-600"
                    : factor.points < 0
                      ? "text-red-600"
                      : "text-muted-foreground",
                )}
              >
                {factor.points > 0 ? "+" : ""}
                {factor.points}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td
              colSpan={2}
              className="pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Итоговый скор
            </td>
            <td className="whitespace-nowrap pt-3 text-right text-sm font-semibold text-foreground">
              {total} / 100
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
