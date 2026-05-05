"use client";

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
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/yaid/metric-card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { InlineCode } from "@/components/api/code-block";

const recentRequests = [
  { id: "prq_8f2a1c93b4", app: "Onboarding Produção", env: "prod" as const, status: "approved" as const, when: "há 4 min" },
  { id: "prq_2b71e0a5d8", app: "Portal Dev", env: "dev" as const, status: "pending" as const, when: "há 12 min" },
  { id: "prq_a55d9f7c10", app: "Onboarding Produção", env: "prod" as const, status: "approved" as const, when: "há 27 min" },
  { id: "prq_7e3c0b4f99", app: "Backoffice KYC", env: "prod" as const, status: "rejected" as const, when: "há 1 h" },
  { id: "prq_1d04ab826f", app: "Portal Homologação", env: "homol" as const, status: "expired" as const, when: "há 3 h" },
];

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Acompanhe o estado das integrações e das solicitações de validação de identidade da sua empresa."
      />

      {/* Métricas */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total de solicitações"
          value="2.847"
          Icon={Activity}
          accent="trust"
          trend={{ value: "+12,4%", direction: "up" }}
          hint="Últimos 30 dias"
        />
        <MetricCard
          label="Aprovadas"
          value="2.413"
          Icon={ShieldCheck}
          accent="verified"
          trend={{ value: "+8,1%", direction: "up" }}
          hint="Taxa de 84,8%"
        />
        <MetricCard
          label="Pendentes"
          value="156"
          Icon={Clock}
          accent="warning"
          trend={{ value: "−3,2%", direction: "down" }}
          hint="Aguardando ação do usuário"
        />
        <MetricCard
          label="Rejeitadas"
          value="278"
          Icon={XCircle}
          accent="destructive"
          trend={{ value: "+1,7%", direction: "up" }}
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
                Configure o webhook de produção
              </h3>
              <p className="mt-1.5 text-sm text-text-secondary">
                Receba o resultado das validações em tempo real. Integrações sem webhook
                dependem de polling manual e podem atrasar o fluxo do usuário final.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/apps"
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Configurar webhook
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
          <p className="mt-3 text-3xl font-semibold text-text-primary">3</p>
          <ul className="mt-4 space-y-2.5">
            <li className="flex items-center justify-between text-sm">
              <span className="truncate text-text-primary">Onboarding Produção</span>
              <EnvBadge env="prod" />
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="truncate text-text-primary">Backoffice KYC</span>
              <EnvBadge env="prod" />
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="truncate text-text-primary">Portal Homologação</span>
              <EnvBadge env="homol" />
            </li>
          </ul>
          <Link
            href="/apps"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-trust hover:underline"
          >
            Gerenciar apps <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Solicitações recentes */}
      <section className="rounded-lg border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Solicitações recentes</h2>
            <p className="text-xs text-text-secondary">Últimas validações criadas pela sua integração.</p>
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
                <th className="px-6 py-3 font-medium">App</th>
                <th className="px-6 py-3 font-medium">Ambiente</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Criada</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((r) => (
                <tr key={r.id} className="yaid-row last:border-0">
                  <td className="px-6 py-3.5">
                    <InlineCode copyable>{r.id}</InlineCode>
                  </td>
                  <td className="px-6 py-3.5 text-text-primary">{r.app}</td>
                  <td className="px-6 py-3.5">
                    <EnvBadge env={r.env} />
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-6 py-3.5 text-right text-text-secondary">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Aviso institucional */}
      <section className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted/60 p-4">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-privacy" strokeWidth={2.25} />
        <p className="text-xs text-text-secondary">
          A YaID nunca expõe documentos brutos no dashboard. A interface mostra apenas o
          resultado da validação e os atributos confirmados pelo usuário final.
        </p>
      </section>
    </>
  );
}
