"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, ChevronLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import { StatusBadge, type StatusKind } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { InlineCode } from "@/components/api/code-block";
import {
  getProofRequest,
  formatProofType,
  confirmedClaims,
  PROOF_REQUEST_STATUS_LABELS,
  NON_APPROVED_MESSAGES,
  type ProofRequestDetail,
  type ProofRequestStatus,
} from "@/utils/proof-requests-store";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

// Backend status → StatusBadge kind. Only `pending_user` needs remapping.
function toStatusKind(status: ProofRequestStatus): StatusKind {
  return status === "pending_user" ? "pending" : status;
}

export default function ProofRequestDetailPage() {
  const params = useParams();
  const requestId = params.requestId as string;

  const [data, setData] = useState<ProofRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProofRequest(requestId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
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
  }, [requestId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-trust border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-text-primary">Solicitação não encontrada</p>
        <p className="max-w-md text-sm text-text-secondary">
          Não foi possível carregar esta solicitação. Ela pode não existir ou não
          pertencer à sua empresa.
        </p>
        <Link
          href="/proof-requests"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Voltar para Proof Requests
        </Link>
      </div>
    );
  }

  const isApproved = data.status === "approved";
  // Only surface confirmed claims when the result is not an explicit failure —
  // guards against an approved request that inconsistently carries result=false.
  const claims = isApproved && data.result !== false ? confirmedClaims(data.proofType) : [];
  const statusLabel = PROOF_REQUEST_STATUS_LABELS[data.status] ?? data.status;

  const summary: { k: string; v: string; code?: boolean }[] = [
    { k: "App", v: data.appName },
    { k: "Tipo", v: formatProofType(data.proofType) },
    ...(data.externalReference
      ? [{ k: "Referência externa", v: data.externalReference, code: true }]
      : []),
    { k: "Criada em", v: formatDate(data.createdAt) },
    { k: "Atualizada em", v: formatDate(data.updatedAt) },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/proof-requests" className="hover:text-text-primary">
          Proof Requests
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="font-mono text-text-primary">{data.id}</span>
      </nav>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href="/proof-requests"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar para a lista
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Solicitação de validação
            </h1>
            <StatusBadge status={toStatusKind(data.status)} label={statusLabel} size="md" />
            <EnvBadge env={data.environment} size="md" />
          </div>
          <div className="flex items-center gap-2">
            <InlineCode copyable>{data.id}</InlineCode>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Resumo */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Resumo</h2>
              <p className="text-xs text-text-secondary">
                A YaID apresenta apenas atributos confirmados. Documentos brutos não
                ficam disponíveis no dashboard.
              </p>
            </div>
            <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {summary.map((item) => (
                <div key={item.k} className="px-6 py-4">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                    {item.k}
                  </dt>
                  <dd className="mt-1.5 text-sm text-text-primary">
                    {item.code ? <InlineCode copyable>{item.v}</InlineCode> : item.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Atributos confirmados */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Atributos confirmados
                </h2>
                <p className="text-xs text-text-secondary">
                  {isApproved
                    ? "O usuário aprovou o compartilhamento dos seguintes atributos."
                    : "Nenhum atributo confirmado para o status atual."}
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-verified" />
            </div>
            {isApproved && claims.length > 0 ? (
              <ul className="divide-y divide-border">
                {claims.map((claim) => (
                  <li
                    key={claim.key}
                    className="flex items-center justify-between px-6 py-3.5"
                  >
                    <span className="text-sm text-text-secondary">{claim.label}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-text">
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                      Confirmado
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-6 py-5">
                <p className="text-sm text-text-secondary">
                  {NON_APPROVED_MESSAGES[
                    data.status as Exclude<ProofRequestStatus, "approved">
                  ] ?? "Sem atributos confirmados."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral — privacidade */}
        <aside className="space-y-6">
          <div className="rounded-lg border border-privacy/30 bg-privacy/5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-privacy">
              Privacidade
            </p>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              A empresa solicitou esta validação. A YaID não armazena dados pessoais do
              holder — apenas atributos booleanos confirmados. Documentos pessoais brutos
              permanecem sob controle do titular e não são acessíveis através do dashboard.
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
