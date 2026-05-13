import { cn } from "@/utils/utils";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  Icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  hint?: string;
  accent?: "default" | "verified" | "warning" | "trust" | "destructive";
  className?: string;
}

const accentMap: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "bg-surface-muted text-text-secondary",
  verified: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  trust: "bg-info-bg text-info-text",
  destructive: "bg-error-bg text-error-text",
};

export function MetricCard({
  label,
  value,
  Icon,
  trend,
  hint,
  accent = "default",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              accentMap[accent],
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-text-primary tabular-nums">{value}</span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trend.direction === "up" && "text-success-text",
              trend.direction === "down" && "text-error-text",
              trend.direction === "flat" && "text-text-tertiary",
            )}
          >
            {trend.direction === "up" && <TrendingUp className="h-3 w-3" />}
            {trend.direction === "down" && <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-text-tertiary">{hint}</p>}
    </div>
  );
}
