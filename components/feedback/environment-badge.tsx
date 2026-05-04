import { cn } from "@/lib/utils";
import { FlaskConical, ShieldCheck } from "lucide-react";

interface EnvBadgeProps {
  env: "sandbox" | "production";
  className?: string;
  size?: "sm" | "md";
}

export function EnvBadge({ env, className, size = "sm" }: EnvBadgeProps) {
  const isSandbox = env === "sandbox";
  return (
    <span
      className={cn(
        "yaid-badge",
        isSandbox
          ? "bg-env-sandbox-bg text-env-sandbox-text border-env-sandbox-border"
          : "bg-env-prod-bg text-env-prod-text border-env-prod-border",
        size === "md" && "px-3 py-1 text-sm",
        className,
      )}
    >
      {isSandbox ? (
        <FlaskConical className={cn(size === "md" ? "h-3.5 w-3.5" : "h-3 w-3")} strokeWidth={2.25} />
      ) : (
        <ShieldCheck className={cn(size === "md" ? "h-3.5 w-3.5" : "h-3 w-3")} strokeWidth={2.25} />
      )}
      {isSandbox ? "Sandbox" : "Production"}
    </span>
  );
}
