"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge, type StatusKind } from "@/components/feedback/status-badge";
import { InlineCode } from "@/components/api/code-block";
import { MetricCard } from "@/components/yaid/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCardsSkeleton, TableRowsSkeleton } from "@/components/shared/list-skeleton";
import {
  countByStatus,
  formatProofType,
  listProofRequests,
  type ProofRequest,
  type ProofRequestStatus,
} from "@/utils/proof-requests-store";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function toBadgeStatus(status: ProofRequestStatus): StatusKind {
  if (status === "pending_user") return "pending";
  return status;
}

export default function ProofRequestsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProofRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listProofRequests()
      .then((data) => setItems(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => countByStatus(items), [items]);

  return (
    <>
      <PageHeader
        title="Proof Requests"
        description="Solicitações de validação enviadas aos usuários finais. Cada solicitação confirma atributos sem expor documentos brutos."
      />

      {loading ? (
        <MetricCardsSkeleton />
      ) : !error ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total"
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
            hint="Validações concluídas"
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
      ) : null}

      <section className="rounded-lg border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="px-6 py-3 font-medium">ID</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Referência externa</th>
                <th className="px-6 py-3 font-medium">Criada em</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableRowsSkeleton rows={5} cols={6} />}

              {!loading && error && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
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
                  </td>
                </tr>
              )}

              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ShieldCheck}
                      title="Nenhuma solicitação ainda"
                      description="Proof requests criadas via POST /api/proof-requests com sua API key aparecerão aqui com o status em tempo real."
                    />
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="yaid-row cursor-pointer last:border-0"
                    onClick={() => router.push(`/proof-requests/${item.id}`)}
                  >
                    <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <InlineCode copyable className="max-w-[140px]">
                        {item.id}
                      </InlineCode>
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary">
                      {formatProofType(item.proofType)}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={toBadgeStatus(item.status)} />
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary">
                      {item.externalRef ?? "—"}
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary tabular-nums">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-trust">
                        Detalhes <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && items.length > 0 && (
          <div className="border-t border-border px-6 py-3">
            <span className="text-xs text-text-tertiary">
              Mostrando{" "}
              <span className="font-medium text-text-secondary">{items.length}</span>{" "}
              solicitações
            </span>
          </div>
        )}
      </section>
    </>
  );
}
