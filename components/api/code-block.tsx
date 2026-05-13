"use client";

import { cn } from "@/utils/utils";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function copyToClipboard(text: string): Promise<"copied" | "manual" | "failed"> {
  try {
    if (!navigator.clipboard?.writeText) {
      window.prompt("Copie o texto abaixo:", text);
      return "manual";
    }

    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

interface CodeBlockProps {
  code: string;
  language?: string;
  copyable?: boolean;
  className?: string;
}

export function CodeBlock({ code, language, copyable = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const result = await copyToClipboard(code);
    if (result === "copied") {
      setCopied(true);
      toast.success("Copiado para a área de transferência");
      setTimeout(() => setCopied(false), 1500);
    } else if (result === "manual") {
      toast.info("Copie manualmente pelo campo exibido");
    } else {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className={cn("yaid-code overflow-hidden", className)}>
      {(language || copyable) && (
        <div
          className="flex items-center justify-between border-b px-4 py-2"
          style={{ borderColor: "var(--color-code-border)" }}
        >
          <span className="text-[11px] uppercase tracking-wider text-code-accent/80">
            {language ?? "text"}
          </span>
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-code-fg/80 transition-colors hover:bg-white/5 hover:text-code-fg"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface InlineCodeProps {
  children: React.ReactNode;
  className?: string;
  copyable?: boolean;
}

export function InlineCode({ children, className, copyable }: InlineCodeProps) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === "string" ? children : String(children ?? "");

  const handleCopy = async () => {
    const result = await copyToClipboard(text);
    if (result === "copied") {
      setCopied(true);
      toast.success("Copiado");
      setTimeout(() => setCopied(false), 1500);
    } else if (result === "manual") {
      toast.info("Copie manualmente pelo campo exibido");
    } else {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-primary",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate" title={text}>
        {children}
      </span>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 text-text-tertiary transition-colors hover:text-trust"
          aria-label="Copiar"
          title="Copiar"
        >
          {copied ? <Check className="h-3 w-3 text-success-text" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
    </span>
  );
}
