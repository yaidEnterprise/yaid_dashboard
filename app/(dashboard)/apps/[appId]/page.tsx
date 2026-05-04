"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Globe,
  KeyRound,
  Activity,
  Clock,
  ShieldCheck,
  XCircle,
  Copy,
  RefreshCw,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { getApps, type YaidApp } from "@/lib/apps-store";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { StatusBadge } from "@/components/feedback/status-badge";
import { InlineCode } from "@/components/api/code-block";

const MOCK_REQUESTS = [
  { id: "prq_8f2a1c93b4d6", status: "approved" as const, proof_type: "personhood", created: "há 4 min" },
  { id: "prq_2b71e0a5d8cc", status: "pending" as const, proof_type: "personhood", created: "há 12 min" },
  { id: "prq_a55d9f7c1033", status: "approved" as const, proof_type: "personhood", created: "há 27 min" },
  { id: "prq_7e3c0b4f99a1", status: "rejected" as const, proof_type: "personhood", created: "há 1 h" },
  { id: "prq_1d04ab826f77", status: "expired" as const, proof_type: "personhood", created: "há 3 h" },
];

export default function AppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.appId as string;

  const [app, setApp] = useState<YaidApp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const all = getApps();
    const found = all.find((a) => a.id === appId);
    setApp(found ?? null);
    setLoading(false);
  }, [appId]);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-trust border-t-transparent" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-text-primary">App não encontrado</p>
        <p className="text-sm text-text-secondary">O identificador <code className="font-mono text-xs bg-surface-muted px-1.5 py-0.5 rounded">{appId}</code> não corresponde a nenhum app.</p>
        <Link
          href="/apps"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Voltar para Apps
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/apps" className="hover:text-text-primary">Apps</Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-text-primary">{app.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href="/apps"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar para a lista
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">{app.name}</h1>
            <EnvBadge env={app.env} />
            <StatusBadge status={app.status} />
          </div>
          {app.description && (
            <p className="max-w-2xl text-sm text-text-secondary">{app.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              toast.success(app.status === "active" ? "App desativado" : "App reativado");
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {app.status === "active" ? (
              <><PowerOff className="h-4 w-4" /> Desativar</>
            ) : (
              <><Power className="h-4 w-4" /> Reativar</>
            )}
          </button>
        </div>
      </div>

      {/* Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Informações gerais */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Informações gerais</h2>
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">ID do app</span>
                <InlineCode copyable>{app.id}</InlineCode>
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Ambiente</span>
                <EnvBadge env={app.env} />
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Status</span>
                <StatusBadge status={app.status} />
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Criado em</span>
                <span className="text-sm text-text-primary">{app.created}</span>
              </div>
            </div>
          </div>

          {/* Webhook */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-text-tertiary" />
                <h2 className="text-base font-semibold text-text-primary">Webhook</h2>
              </div>
              <p className="mt-1 text-xs text-text-secondary">URL HTTPS que recebe os eventos das solicitações deste app.</p>
            </div>
            <div className="px-6 py-5">
              {app.webhook === "—" ? (
                <p className="text-sm text-text-tertiary">Nenhum webhook configurado.</p>
              ) : (
                <div className="flex items-stretch gap-2">
                  <code className="flex-1 select-all overflow-x-auto rounded-md border border-border bg-surface-muted px-3 py-2.5 font-mono text-xs text-text-primary">
                    {app.webhook}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(app.webhook, "Webhook")}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* API Key */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-text-tertiary" />
                <h2 className="text-base font-semibold text-text-primary">Chave de API</h2>
              </div>
              <p className="mt-1 text-xs text-text-secondary">A chave secreta foi exibida apenas no momento da criação do app.</p>
            </div>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-sm text-text-primary">
                  Prefixo: <code className="font-mono text-xs bg-surface-muted px-1.5 py-0.5 rounded border border-border">{app.env === "production" ? "yaid_live_" : "yaid_test_"}****</code>
                </p>
                <p className="mt-1 text-xs text-text-tertiary">Para ver a chave completa, rotacione e copie a nova chave.</p>
              </div>
              <button
                type="button"
                onClick={() => toast.info("Funcionalidade de rotacionar chave será implementada com o backend.")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rotacionar chave
              </button>
            </div>
          </div>

          {/* Últimas solicitações */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Últimas solicitações</h2>
                <p className="text-xs text-text-secondary">Proof requests geradas por este app.</p>
              </div>
              <Link
                href="/proof-requests"
                className="text-sm font-medium text-trust hover:underline"
              >
                Ver todas →
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
                  {MOCK_REQUESTS.map((req) => (
                    <tr key={req.id} className="yaid-row last:border-0">
                      <td className="px-6 py-3.5">
                        <InlineCode copyable>{req.id}</InlineCode>
                      </td>
                      <td className="px-6 py-3.5 text-text-primary capitalize">{req.proof_type}</td>
                      <td className="px-6 py-3.5">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-6 py-3.5 text-right text-text-secondary">{req.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar stats */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Métricas (30 dias)</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-trust" />
                  <span className="text-sm text-text-secondary">Total</span>
                </div>
                <span className="text-lg font-semibold text-text-primary">847</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-verified" />
                  <span className="text-sm text-text-secondary">Aprovadas</span>
                </div>
                <span className="text-lg font-semibold text-text-primary">712</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning-text" />
                  <span className="text-sm text-text-secondary">Pendentes</span>
                </div>
                <span className="text-lg font-semibold text-text-primary">48</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-error-text" />
                  <span className="text-sm text-text-secondary">Rejeitadas</span>
                </div>
                <span className="text-lg font-semibold text-text-primary">87</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-trust/30 bg-trust/5 p-5">
            <div className="flex items-center gap-2 text-trust">
              <KeyRound className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Segurança</p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-text-secondary">
              <li>• A chave secreta não pode ser visualizada após a criação.</li>
              <li>• Rotacione a chave sempre que suspeitar de vazamento.</li>
              <li>• Use variáveis de ambiente — nunca commit no código.</li>
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}
