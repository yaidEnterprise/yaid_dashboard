"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/utils/utils";

type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "inline" | "standalone";
  className?: string;
  onCopied?: () => void;
};

export function CopyButton({
  value,
  label = "Copiar",
  copiedLabel = "Copiado",
  variant = "inline",
  className,
  onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard failure is handled by the parent via onCopied absence
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary",
        variant === "inline" ? "px-3" : "h-10 px-4",
        className
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success-text" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? copiedLabel : label}
    </button>
  );
}
