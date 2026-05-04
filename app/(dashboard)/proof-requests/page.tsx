"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Calendar, ChevronRight, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge, type StatusKind } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { InlineCode } from "@/components/api/code-block";
import { FilterPopover } from "@/components/yaid/filter-popover";

type Env = "sandbox" | "production";
type Range = "1d" | "7d" | "30d" | "all";

type Row = {
  id: string;
  app: string;
  env: Env;
  type: string;
  status: StatusKind;
  created: string;
  expires: string;
  daysAgo: number;
};

const rows: Row[] = [
  { id: "prq_8f2a1c93b4d6", app: "Onboarding Produção", env: "production", type: "Documento + Liveness", status: "approved", created: "29 abr 14:32", expires: "—", daysAgo: 0 },
  { id: "prq_2b71e0a5d8c1", app: "Portal Sandbox",      env: "sandbox",    type: "Documento",            status: "pending",  created: "29 abr 14:20", expires: "29 abr 16:20", daysAgo: 0 },
  { id: "prq_a55d9f7c10ab", app: "Onboarding Produção", env: "production", type: "Documento + Liveness", status: "approved", created: "28 abr 14:05", expires: "—", daysAgo: 1 },
  { id: "prq_7e3c0b4f9912", app: "Backoffice KYC",      env: "production", type: "Reverificação",        status: "rejected", created: "26 abr 13:30", expires: "—", daysAgo: 3 },
  { id: "prq_1d04ab826f78", app: "Portal Sandbox",      env: "sandbox",    type: "Documento",            status: "expired",  created: "24 abr 11:10", expires: "24 abr 13:10", daysAgo: 5 },
  { id: "prq_55c81e9a7b04", app: "Onboarding Produção", env: "production", type: "Documento + Liveness", status: "processing", created: "22 abr 10:48", expires: "22 abr 12:48", daysAgo: 7 },
  { id: "prq_9af402c6dd31", app: "Backoffice KYC",      env: "production", type: "Reverificação",        status: "approved", created: "10 abr 09:22", expires: "—", daysAgo: 19 },
];

const STATUS_OPTIONS: { value: StatusKind; label: string }[] = [
  { value: "approved", label: "Aprovada" },
  { value: "pending", label: "Pendente" },
  { value: "processing", label: "Em processamento" },
  { value: "rejected", label: "Rejeitada" },
  { value: "expired", label: "Expirada" },
];

const APP_OPTIONS = Array.from(new Set(rows.map((r) => r.app))).map((a) => ({
  value: a,
  label: a,
}));

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "1d", label: "Últimas 24 horas" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "all", label: "Todo o período" },
];

const RANGE_DAYS: Record<Range, number> = { "1d": 1, "7d": 7, "30d": 30, all: Infinity };

export default function ProofRequestsPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKind[]>([]);
  const [envFilter, setEnvFilter] = useState<Env[]>([]);
  const [appFilter, setAppFilter] = useState<string[]>([]);
  const [range, setRange] = useState<Range>("7d");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const maxDays = RANGE_DAYS[range];
    return rows.filter((r) => {
      if (q && !r.id.toLowerCase().includes(q) && !r.app.toLowerCase().includes(q)) return false;
      if (statusFilter.length && !statusFilter.includes(r.status)) return false;
      if (envFilter.length && !envFilter.includes(r.env)) return false;
      if (appFilter.length && !appFilter.includes(r.app)) return false;
      if (r.daysAgo > maxDays) return false;
      return true;
    });
  }, [query, statusFilter, envFilter, appFilter, range]);

  const counts = useMemo(() => {
    const c = { approved: 0, pending: 0, rejected: 0, expired: 0 };
    filtered.forEach((r) => {
      if (r.status === "approved") c.approved++;
      else if (r.status === "pending" || r.status === "processing") c.pending++;
      else if (r.status === "rejected") c.rejected++;
      else if (r.status === "expired") c.expired++;
    });
    return c;
  }, [filtered]);

  const hasActiveFilters =
    query !== "" ||
    statusFilter.length > 0 ||
    envFilter.length > 0 ||
    appFilter.length > 0 ||
    range !== "7d";

  const currentRangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "Período";

  return (
    <>
      <PageHeader
        title="Proof Requests"
        description="Solicitações de validação enviadas aos usuários finais. Cada solicitação confirma atributos sem expor documentos brutos."
        actions={
          <Link
            href="/proof-requests/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Criar solicitação
          </Link>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ID ou referência externa"
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPopover<StatusKind>
            label="Status"
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterPopover<Env>
            label="Ambiente"
            options={[
              { value: "production", label: "Production" },
              { value: "sandbox", label: "Sandbox" },
            ]}
            selected={envFilter}
            onChange={setEnvFilter}
          />
          <FilterPopover<string>
            label="App"
            options={APP_OPTIONS}
            selected={appFilter}
            onChange={setAppFilter}
          />
          <FilterPopover<Range>
            label={currentRangeLabel}
            options={RANGE_OPTIONS}
            selected={[range]}
            onChange={(next) => setRange((next[next.length - 1] ?? "7d") as Range)}
            icon={<Calendar className="h-4 w-4" />}
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter([]);
                setEnvFilter([]);
                setAppFilter([]);
                setRange("7d");
              }}
              className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Aprovadas", value: counts.approved, tone: "text-success-text bg-success-bg border-success-border" },
          { label: "Pendentes", value: counts.pending, value2: counts.pending, tone: "text-warning-text bg-warning-bg border-warning-border" },
          { label: "Rejeitadas", value: counts.rejected, tone: "text-error-text bg-error-bg border-error-border" },
          { label: "Expiradas", value: counts.expired, tone: "text-neutral-text bg-neutral-bg border-neutral-border" },
        ].map((s) => (
          <div key={s.label} className={`rounded-md border px-4 py-3 ${s.tone}`}>
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <section className="rounded-lg border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="px-6 py-3 font-medium">ID</th>
                <th className="px-6 py-3 font-medium">App</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Ambiente</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Criada</th>
                <th className="px-6 py-3 font-medium">Expira</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-text-tertiary">
                    Nenhuma solicitação encontrada com esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="yaid-row last:border-0">
                  <td className="px-6 py-3.5">
                    <InlineCode copyable>{r.id}</InlineCode>
                  </td>
                  <td className="px-6 py-3.5 text-text-primary">{r.app}</td>
                  <td className="px-6 py-3.5 text-text-secondary">{r.type}</td>
                  <td className="px-6 py-3.5">
                    <EnvBadge env={r.env} />
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-6 py-3.5 text-text-secondary tabular-nums">{r.created}</td>
                  <td className="px-6 py-3.5 text-text-tertiary tabular-nums">{r.expires}</td>
                  <td className="px-6 py-3.5 text-right">
                    <Link
                      href={`/proof-requests/${r.id}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-trust hover:underline"
                    >
                      Detalhes <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <span className="text-xs text-text-tertiary">
            Mostrando <span className="font-medium text-text-secondary">{filtered.length}</span> de{" "}
            <span className="font-medium text-text-secondary">{rows.length}</span>
          </span>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled
              className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-tertiary disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled
              className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-tertiary disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
