"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ShieldHalf,
  Clock,
  Loader2,
  CheckCircle2,
  Lock,
  QrCode,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";

type ProofSession = {
  id: string;
  proofRequestId: string;
  verificationPageUrl: string;
  deepLinkUrl: string;
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  approvedAt: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VerificationPage() {
  const params = useParams();
  const sessionToken = params.sessionToken as string;

  const [session, setSession] = useState<ProofSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openedApp, setOpenedApp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proof-sessions/${sessionToken}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error?.message || "Sessão inválida");
        }
        return json as ProofSession;
      })
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        setError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Loader2 className="h-8 w-8 animate-spin text-trust" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-bg">
            <XCircle className="h-7 w-7 text-error-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="rejected" label="Inválida" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Sessão inválida</h1>
          <p className="text-sm text-text-secondary">
            {error || "Este link não corresponde a uma sessão de validação ativa."}
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "expired" || session.status === "cancelled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-bg">
            <Clock className="h-7 w-7 text-neutral-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="expired" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Sessão expirada</h1>
          <p className="text-sm text-text-secondary">
            Esta solicitação expirou ou foi cancelada. Volte para a plataforma parceira e solicite uma nova validação.
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "approved_by_user") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-bg">
            <CheckCircle2 className="h-7 w-7 text-success-text" strokeWidth={2} />
          </div>
          <StatusBadge status="approved" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Validação concluída</h1>
          <p className="text-sm text-text-secondary">
            Sua validação foi processada. Você pode retornar para a plataforma parceira.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
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

          <div className="mb-6 space-y-2 rounded-xl bg-surface-muted p-4 text-left">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-text-tertiary">Solicitação</span>
              <span className="truncate font-mono text-xs font-medium text-text-primary">
                {session.proofRequestId}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-text-tertiary">Expira em</span>
              <span className="font-medium text-text-primary">{formatTime(session.expiresAt)}</span>
            </div>
          </div>

          <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-muted">
            <QrCode className="h-10 w-10 text-text-tertiary" strokeWidth={1.5} />
          </div>

          <a
            href={session.deepLinkUrl}
            onClick={() => setOpenedApp(true)}
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Abrir app YaID
            <ExternalLink className="h-4 w-4" />
          </a>

          {openedApp || session.status === "opened" ? (
            <div className="mt-3 rounded-lg border border-info-border bg-info-bg px-4 py-3 text-left">
              <p className="text-xs font-medium text-info-text">Aguardando confirmação no app YaID.</p>
            </div>
          ) : null}

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

