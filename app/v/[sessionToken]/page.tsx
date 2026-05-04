"use client";

import { useState, useEffect } from "react";
import { ShieldHalf, Clock, Loader2, CheckCircle2, Lock, QrCode } from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";

type SessionState = "valid" | "expired" | "waiting" | "success" | "invalid";

export default function VerificationPage() {
  const [state, setState] = useState<SessionState>("valid");
  const [countdown, setCountdown] = useState(5);

  // Simulate state transitions for demo
  useEffect(() => {
    if (state === "waiting") {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            setState("success");
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state]);

  if (state === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-bg">
            <Clock className="h-7 w-7 text-neutral-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="expired" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Sessão expirada</h1>
          <p className="mb-6 text-sm text-text-secondary">
            Esta solicitação de validação expirou. Volte para a plataforma parceira e solicite uma nova validação.
          </p>
          <button
            onClick={() => setState("valid")}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entendi
          </button>
        </div>
      </div>
    );
  }

  if (state === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-info-bg">
            <Loader2 className="h-7 w-7 animate-pulse text-info-text" strokeWidth={1.8} />
          </div>
          <h1 className="mb-2 text-xl font-bold text-text-primary">Aguardando confirmação no app</h1>
          <p className="mb-6 text-sm text-text-secondary">
            Abra o app YaID no seu celular e aprove o compartilhamento da prova solicitada.
          </p>
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-trust" />
          </div>
          <p className="text-xs text-text-tertiary">Simulação: sucesso em {countdown}s</p>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-bg">
            <CheckCircle2 className="h-7 w-7 text-success-text" strokeWidth={2} />
          </div>
          <StatusBadge status="approved" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Validação concluída</h1>
          <p className="mb-6 text-sm text-text-secondary">
            Sua validação foi processada. Você pode retornar para a plataforma parceira.
          </p>
          <button
            onClick={() => setState("valid")}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar para a plataforma
          </button>
        </div>
      </div>
    );
  }

  // Valid session — main screen
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          {/* Logo */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ShieldHalf className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-text-primary">YaID</span>
          </div>

          <h1 className="mb-2 text-xl font-bold text-text-primary">Confirme sua identidade com YaID</h1>
          <p className="mb-6 text-sm text-text-secondary">
            A empresa parceira está solicitando uma validação de personhood.
          </p>

          {/* Info */}
          <div className="mb-6 space-y-2 rounded-xl bg-surface-muted p-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">Empresa</span>
              <span className="font-medium text-text-primary">XPTO Tecnologia</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">Tipo</span>
              <span className="font-medium text-text-primary">Personhood</span>
            </div>
          </div>

          {/* QR Code placeholder */}
          <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-muted">
            <QrCode className="h-10 w-10 text-text-tertiary" strokeWidth={1.5} />
          </div>

          {/* CTA */}
          <button
            onClick={() => setState("waiting")}
            className="mb-3 w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Abrir app YaID
          </button>

          {/* State demo buttons */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setState("expired")}
              className="text-[11px] text-text-tertiary underline hover:text-text-secondary"
            >
              Simular expirada
            </button>
          </div>

          {/* Privacy */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-privacy" strokeWidth={1.8} />
              <p className="text-left text-[11px] leading-relaxed text-text-tertiary">
                A YaID confirma apenas o resultado da validação. Seus documentos pessoais não são enviados para a empresa parceira.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
