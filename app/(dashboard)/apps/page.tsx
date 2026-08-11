"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, X, LayoutGrid, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { listApps, type AppStatus, type YaidApp } from "@/utils/apps-store";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-6 py-4">
        <div className="space-y-1.5">
          <div className="h-4 w-36 animate-pulse rounded bg-surface-muted" />
          <div className="h-3 w-52 animate-pulse rounded bg-surface-muted" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-24 animate-pulse rounded-full bg-surface-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-surface-muted" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
      </td>
    </tr>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <tr>
      <td colSpan={3} className="px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <LayoutGrid className="h-6 w-6 text-text-tertiary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-text-primary">Nenhum app cadastrado</p>
            <p className="text-sm text-text-secondary">
              Crie seu primeiro app para integrar com a YaID.
            </p>
          </div>
          <Link
            href="/apps/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Criar primeiro app
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <tr>
      <td colSpan={3} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-error-text">{message}</p>
          <button
            type="button"
            id="retry-load-apps"
            onClick={onRetry}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppStatus[]>([]);
  const [apps, setApps] = useState<YaidApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setApps([]);
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listApps()
      .then((items) => {
        if (cancelled) return;
        setApps(items);
        setError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || "Não foi possível carregar os apps.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (q && !app.name.toLowerCase().includes(q) && !app.id.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter.length && !statusFilter.includes(app.status)) return false;
      return true;
    });
  }, [apps, query, statusFilter]);

  const hasActiveFilters = query || statusFilter.length > 0;

  function clearFilters() {
    setQuery("");
    setStatusFilter([]);
  }

  function toggleStatusFilter(s: AppStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  return (
    <>
      <PageHeader
        title="Apps"
        description="Cada app representa uma integração da sua empresa com a YaID. Configure ambiente, webhook e chaves separadamente para cada um."
        actions={
          <Link
            id="create-app-btn"
            href="/apps/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Criar app
          </Link>
        }
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            id="apps-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou identificador"
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter pills */}
          {(["enabled", "disabled"] as AppStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatusFilter(s)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                statusFilter.includes(s)
                  ? "border-trust bg-trust/10 text-trust"
                  : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"
              }`}
            >
              {s === "enabled" ? "Habilitado" : "Desabilitado"}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <section className="rounded-lg border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <colgroup>
              <col className="w-[50%]" />
              <col className="w-[30%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="px-6 py-3 font-medium">Nome do app</th>
                <th className="px-6 py-3 font-medium">Status / Ambiente</th>
                <th className="px-6 py-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading skeleton */}
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {/* Error state */}
              {!loading && error && (
                <ErrorState message={error} onRetry={reload} />
              )}

              {/* Empty state — no apps at all */}
              {!loading && !error && apps.length === 0 && <EmptyState />}

              {/* Filter empty — apps exist but filter yields 0 */}
              {!loading && !error && apps.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-text-tertiary">
                    Nenhum app corresponde ao filtro.
                  </td>
                </tr>
              )}

              {/* Populated */}
              {!loading &&
                !error &&
                filtered.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => router.push(`/apps/${app.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/apps/${app.id}`);
                      }
                    }}
                    tabIndex={0}
                    className="yaid-row cursor-pointer last:border-0 focus:outline-none focus:ring-2 focus:ring-trust/40 focus:ring-inset"
                    role="row"
                    aria-label={`App ${app.name}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">{app.name}</span>
                        <span
                          className="mt-0.5 truncate font-mono text-[11px] text-text-tertiary"
                          title={app.id}
                        >
                          {app.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={app.status} />
                        {app.environment && app.environment !== "dev" && (
                          <EnvBadge env={app.environment} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{formatDate(app.createdAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && !error && apps.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <span className="text-xs text-text-tertiary">
              Mostrando{" "}
              <span className="font-medium text-text-secondary">{filtered.length}</span> de{" "}
              <span className="font-medium text-text-secondary">{apps.length}</span> apps
            </span>
          </div>
        )}
      </section>
    </>
  );
}
