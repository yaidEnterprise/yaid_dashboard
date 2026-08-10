import { cn } from "@/utils/utils";
import { Beaker, FlaskConical, ShieldCheck } from "lucide-react";

export type AppEnvironment = "dev" | "homol" | "prod";

interface EnvBadgeProps {
  env: AppEnvironment;
  className?: string;
  size?: "sm" | "md";
}

const config: Record<
  AppEnvironment,
  { label: string; cls: string; Icon: typeof FlaskConical }
> = {
  dev: {
    label: "Dev",
    cls: "bg-env-sandbox-bg text-env-sandbox-text border-env-sandbox-border",
    Icon: Beaker,
  },
  homol: {
    label: "Homologação",
    cls: "bg-env-sandbox-bg text-env-sandbox-text border-env-sandbox-border",
    Icon: FlaskConical,
  },
  prod: {
    label: "Produção",
    cls: "bg-env-prod-bg text-env-prod-text border-env-prod-border",
    Icon: ShieldCheck,
  },
};

export function EnvBadge({ env, className, size = "sm" }: EnvBadgeProps) {
  const { label, cls, Icon } = config[env];
  return (
    <span
      className={cn(
        "yaid-badge",
        cls,
        size === "md" && "px-3 py-1 text-sm",
        className
      )}
    >
      <Icon
        className={cn(size === "md" ? "h-3.5 w-3.5" : "h-3 w-3")}
        strokeWidth={2.25}
      />
      {label}
    </span>
  );
}
