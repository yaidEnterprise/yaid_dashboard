import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, AlertTriangle, Circle, MinusCircle, type LucideIcon } from "lucide-react";

export type StatusKind =
  | "approved"
  | "pending"
  | "rejected"
  | "expired"
  | "enabled"
  | "disabled"
  | "processing";

const map: Record<StatusKind, { label: string; cls: string; Icon: LucideIcon }> = {
  approved: {
    label: "Approved",
    cls: "bg-success-bg text-success-text border-success-border",
    Icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    cls: "bg-warning-bg text-warning-text border-warning-border",
    Icon: Clock,
  },
  rejected: {
    label: "Rejected",
    cls: "bg-error-bg text-error-text border-error-border",
    Icon: XCircle,
  },
  expired: {
    label: "Expired",
    cls: "bg-neutral-bg text-neutral-text border-neutral-border",
    Icon: MinusCircle,
  },
  enabled: {
    label: "Habilitado",
    cls: "bg-success-bg text-success-text border-success-border",
    Icon: Circle,
  },
  disabled: {
    label: "Desabilitado",
    cls: "bg-neutral-bg text-neutral-text border-neutral-border",
    Icon: MinusCircle,
  },
  processing: {
    label: "Processing",
    cls: "bg-info-bg text-info-text border-info-border",
    Icon: AlertTriangle,
  },
};

interface StatusBadgeProps {
  status: StatusKind;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, className, size = "sm" }: StatusBadgeProps) {
  const { label: defaultLabel, cls, Icon } = map[status];
  return (
    <span
      className={cn(
        "yaid-badge",
        cls,
        size === "md" && "px-3 py-1 text-sm",
        className,
      )}
    >
      <Icon className={cn(size === "md" ? "h-3.5 w-3.5" : "h-3 w-3")} strokeWidth={2.25} />
      {label ?? defaultLabel}
    </span>
  );
}
