"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, KeyRound } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";

type ApiKeyModalProps = {
  open: boolean;
  appName: string;
  apiKey: string;
  onComplete: () => void;
};

export function ApiKeyModal({ open, appName, apiKey, onComplete }: ApiKeyModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      return;
    }

    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-trust/10 text-trust">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 id="api-key-title" className="text-base font-semibold text-text-primary">
              Sua API key
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              App <span className="font-medium text-text-primary">{appName}</span> criado com sucesso.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-start gap-3 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-warning-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed">
              Esta é a única vez que a API key será exibida
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">API key</label>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 select-all overflow-x-auto rounded-md border border-border bg-surface-muted px-3 py-2.5 font-mono text-xs text-text-primary">
                {apiKey}
              </code>
              <CopyButton value={apiKey} />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-muted/50 px-4 py-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-trust"
            />
            <span className="text-xs leading-relaxed text-text-primary">
              Confirmo que copiei minha API key
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-muted/30 px-6 py-4">
          <button
            type="button"
            onClick={onComplete}
            disabled={!confirmed}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
