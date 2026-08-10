"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Activity,
  Clock,
  XCircle,
  ArrowRight,
  Sparkles,
  Boxes,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/yaid/metric-card";
import { StatusBadge, type StatusKind } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { InlineCode } from "@/components/api/code-block";
import { MetricCardsSkeleton } from "@/components/shared/list-skeleton";
import { listApps, type YaidApp } from "@/utils/apps-store";
import {
  countByStatus,
  formatProofType,
  listProofRequests,
  truncateId,
  type ProofRequestDetail,
  type ProofRequestStatus,
} from "@/utils/proof-requests-store";
import { fetchWithAuth } from "@/utils/fetch-with-auth";

// ─── Types ──────────────────────────────────────────────────────────────────

type CompanyData = {
  id: string;
  name: string;
  cnpj: string | null;
  status: "active" | "inactive";
  createdAt: string;
};

type NextStepInfo = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNextStep(apps: YaidApp[], proofRequests: ProofRequestDetail[]): NextStepInfo {
  if (apps.length === 0) {
    return {
      title: "Crie seu primeiro aplicativo",
      description:
        "Para começar a usar a YaID, cadastre um app e receba sua API key para integração.",
      ctaLabel: "Criar aplicativo",
      ctaHref: "/apps/new",
    };
  }
  if (proofRequests.length === 0) {
    return {
      title: "Crie sua primeira solicitação de verificação",
      description:
        "Use sua API key para criar uma proof request via POST /api/proof-requests e validar a identidade dos seus usuários.",
      ctaLabel: "Ver solicitações",
      ctaHref: "/proof-requests",
    };
  }
  return {
    title: "Acompanhe suas validações",
    description:
      "Verifique o status das suas solicitações de verificação. Configure webhooks para receber notificações em tempo real.",
    ctaLabel: "Ver solicitações",
    ctaHref: "/proof-requests",
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

function toBadgeStatus(status: ProofRequestStatus): StatusKind {
  if (status === "pending_user") return "pending";
  return status;
}

async function fetchCompany(): Promise<CompanyData> {
  const res = await fetchWithAuth("/api/companies/me", { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && json.error?.message) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return json as CompanyData;
}

// ─── Skeleton for the "Próximo passo" + "Apps ativos" row ───────────────────

function NextStepSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-lg border border-border bg-surface p-6 lg:col-span-2">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-surface-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-40 animate-pulse rounded bg-surface-muted" />
            <div className="h-5 w-64 animate-pulse rounded bg-surface-muted" />
            <div className="h-4 w-80 animate-pulse rounded bg-surface-muted" />
            <div className="h-9 w-40 animate-pulse rounded-md bg-surface-muted" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-4 animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="mt-3 h-8 w-8 animate-pulse rounded bg-surface-muted" />
        <div className="mt-4 space-y-2.5">
          <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
    </section>
  );
}

function RecentTableSkeleton() {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-surface-muted" />
          <div className="h-3 w-64 animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
              <th className="px-6 py-3 font-medium">ID</th>
              <th className="px-6 py-3 font-medium">Tipo</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Criada</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {Array.from({ length: 4 }).map((_, col) => (
                  <td key={col} className="px-6 py-3.5">
                    <div className="h-4 w-full max-w-[120px] animate-pulse rounded-md bg-surface-muted" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [apps, setApps] = useState<YaidApp[]>([]);
  const [proofRequests, setProofRequests] = useState<ProofRequestDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchCompany(), listApps(), listProofRequests()])
      .then(([companyData, appsData, prData]) => {
        setCompany(companyData);
        setApps(appsData);
        setProofRequests(prData);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => countByStatus(proofRequests), [proofRequests]);
  const nextStep = useMemo(() => getNextStep(apps, proofRequests), [apps, proofRequests]);
  const enabledApps = useMemo(() => apps.filter((a) => a.status === "enabled"), [apps]);
  const recentRequests = useMemo(
    () =>
      [...proofRequests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [proofRequests],
  );

  return (
    <>
      <PageHeader
        title="Overview"
        description="Acompanhe o estado das integrações e das solicitações de validação de identidade da sua empresa."
      />

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <>
          <MetricCardsSkeleton />
          <NextStepSkeleton />
          <RecentTableSkeleton />
        </>
      )}

      {/* ── Error ───────────────────────────────────────────────────── */}
      {!loading && error && (
        <section className="rounded-lg border border-border bg-surface p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 text-sm text-error-text">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary transition-colors hover:border-border-strong"
            >
              Tentar novamente
            </button>
          </div>
        </section>
      )}

      {/* ── Data loaded ─────────────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {/* Métricas */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total de solicitações"
              value={String(counts.total)}
              Icon={Activity}
              accent="trust"
              hint="Todas as solicitações"
            />
            <MetricCard
              label="Aprovadas"
              value={String(counts.approved)}
              Icon={ShieldCheck}
              accent="verified"
              hint={
                counts.total > 0
                  ? `Taxa de ${((counts.approved / counts.total) * 100).toFixed(1)}%`
                  : "Nenhuma solicitação ainda"
              }
            />
            <MetricCard
              label="Pendentes"
              value={String(counts.pending)}
              Icon={Clock}
              accent="warning"
              hint="Aguardando ação do usuário"
            />
            <MetricCard
              label="Rejeitadas"
              value={String(counts.rejected)}
              Icon={XCircle}
              accent="destructive"
              hint="Inclui falhas e expirações"
            />
          </section>

          {/* Próximo passo + Apps ativos */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-privacy/30 bg-privacy/5 p-6 lg:col-span-2">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-privacy text-privacy-foreground">
                  <Sparkles className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-privacy">
                    Próximo passo recomendado
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-text-primary">
                    {nextStep.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-text-secondary">
                    {nextStep.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={nextStep.ctaHref}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {nextStep.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Apps ativos
                </p>
                <Boxes className="h-4 w-4 text-text-tertiary" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-text-primary">
                {enabledApps.length}
              </p>
              {enabledApps.length > 0 ? (
                <ul className="mt-4 space-y-2.5">
                  {enabledApps.slice(0, 5).map((app) => (
                    <li key={app.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-text-primary">{app.name}</span>
                      <EnvBadge env={app.environment} />
                    </li>
                  ))}
                  {enabledApps.length > 5 && (
                    <li className="text-xs text-text-tertiary">
                      e mais {enabledApps.length - 5} app{enabledApps.length - 5 > 1 ? "s" : ""}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-text-secondary">
                  Nenhum app ativo ainda.
                </p>
              )}
              <Link
                href="/apps"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-trust hover:underline"
              >
                Gerenciar apps <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          {/* Solicitações recentes — only if there are proof requests */}
          {recentRequests.length > 0 && (
            <section className="rounded-lg border border-border bg-surface shadow-card">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Solicitações recentes
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Últimas validações criadas pela sua integração.
                  </p>
                </div>
                <Link
                  href="/proof-requests"
                  className="inline-flex items-center gap-1 text-sm font-medium text-trust hover:underline"
                >
                  Ver todas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/50 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                      <th className="px-6 py-3 font-medium">ID</th>
                      <th className="px-6 py-3 font-medium">Tipo</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Criada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRequests.map((r) => (
                      <tr key={r.id} className="yaid-row last:border-0">
                        <td className="px-6 py-3.5">
                          <InlineCode copyable>{truncateId(r.id)}</InlineCode>
                        </td>
                        <td className="px-6 py-3.5 text-text-secondary">
                          {formatProofType(r.proofType)}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={toBadgeStatus(r.status)} />
                        </td>
                        <td className="px-6 py-3.5 text-right text-text-secondary">
                          {timeAgo(r.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Aviso institucional */}
          <section className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted/60 p-4">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-privacy" strokeWidth={2.25} />
            <p className="text-xs text-text-secondary">
              A YaID nunca expõe documentos brutos no dashboard. A interface mostra apenas o
              resultado da validação e os atributos confirmados pelo usuário final.
            </p>
          </section>
        </>
      )}
    </>
  );
}
