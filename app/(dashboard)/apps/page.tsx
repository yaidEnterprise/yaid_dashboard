"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { FilterPopover } from "@/components/yaid/filter-popover";
import { listApps, type AppEnv, type AppStatus, type YaidApp } from "@/lib/apps-store";

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

export default function AppsPage() {
  const [query, setQuery] = useState("");
  const [envFilter, setEnvFilter] = useState<AppEnv[]>([]);
  const [statusFilter, setStatusFilter] = useState<AppStatus[]>([]);
  const [apps, setApps] = useState<YaidApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (q && !app.name.toLowerCase().includes(q) && !app.id.toLowerCase().includes(q)) {
        return false;
      }
      if (envFilter.length && !envFilter.includes(app.environment)) return false;
      if (statusFilter.length && !statusFilter.includes(app.status)) return false;
      return true;
    });
  }, [apps, query, envFilter, statusFilter]);

  async function copyWebhook(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <>
      <PageHeader
        title="Apps"
        description="Cada app representa uma integração da sua empresa com a YaID. Configure ambiente, webhook e chaves separadamente para cada um."
        actions={
          <Link
            href="/apps/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Criar app
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou identificador"
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPopover<AppEnv>
            label="Ambiente"
            options={[
              { value: "prod", label: "Produção" },
              { value: "homol", label: "Homologação" },
              { value: "dev", label: "Dev" },
            ]}
            selected={envFilter}
            onChange={setEnvFilter}
          />
          <FilterPopover<AppStatus>
            label="Status"
            options={[
              { value: "enabled", label: "Habilitado" },
              { value: "disabled", label: "Desabilitado" },
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          {(envFilter.length > 0 || statusFilter.length > 0 || query) && (
            <button
              type="button"
              onClick={() => {
                setEnvFilter([]);
                setStatusFilter([]);
                setQuery("");
              }}
              className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="px-6 py-3 font-medium">Nome do app</th>
                <th className="px-6 py-3 font-medium">Ambiente</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Webhook</th>
                <th className="px-6 py-3 font-medium">Criado em</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-tertiary">
                    Carregando apps…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-error-text">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-tertiary">
                    Nenhum app encontrado.
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.map((app) => (
                <tr key={app.id} className="yaid-row last:border-0">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-text-primary">{app.name}</span>
                      <span className="mt-0.5 truncate font-mono text-[11px] text-text-tertiary" title={app.id}>
                        {app.id}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <EnvBadge env={app.environment} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => copyWebhook(app.webhookUrl)}
                      className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-primary transition-colors hover:border-trust/50"
                      title={`Copiar: ${app.webhookUrl}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{app.webhookUrl}</span>
                      <Copy className="h-3 w-3 shrink-0 text-text-tertiary transition-colors group-hover:text-trust" />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{formatDate(app.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/apps/${app.id}`}
                      className="inline-flex h-8 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-xs font-medium leading-none text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                    >
                      Ver detalhes
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
            <span className="font-medium text-text-secondary">{apps.length}</span> apps
          </span>
        </div>
      </section>
    </>
  );
}
