"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Globe,
  KeyRound,
  Copy,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { getApp, updateApp, type YaidApp } from "@/utils/apps-store";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { StatusBadge } from "@/components/feedback/status-badge";
import { InlineCode } from "@/components/api/code-block";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function AppDetailPage() {
  const params = useParams();
  const appId = params.appId as string;

  const [app, setApp] = useState<YaidApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getApp(appId)
      .then((data) => {
        if (cancelled) return;
        setApp(data);
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
  }, [appId]);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function toggleStatus() {
    if (!app) return;
    const next = app.status === "enabled" ? "disabled" : "enabled";
    setToggling(true);
    try {
      const updated = await updateApp(app.id, { status: next });
      setApp(updated);
      toast.success(next === "enabled" ? "App reativado" : "App desativado");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao atualizar o app");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-trust border-t-transparent" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-text-primary">App não encontrado</p>
        <p className="text-sm text-text-secondary">
          {error || (
            <>
              O identificador <code className="font-mono text-xs bg-surface-muted px-1.5 py-0.5 rounded">{appId}</code> não corresponde a nenhum app.
            </>
          )}
        </p>
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
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/apps" className="hover:text-text-primary">Apps</Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-text-primary">{app.name}</span>
      </nav>

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
            <EnvBadge env={app.environment} />
            <StatusBadge status={app.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleStatus}
            disabled={toggling}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            {app.status === "enabled" ? (
              <><PowerOff className="h-4 w-4" /> Desativar</>
            ) : (
              <><Power className="h-4 w-4" /> Reativar</>
            )}
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
                <EnvBadge env={app.environment} />
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Status</span>
                <StatusBadge status={app.status} />
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Criado em</span>
                <span className="text-sm text-text-primary">{formatDate(app.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-text-tertiary" />
                <h2 className="text-base font-semibold text-text-primary">Webhook</h2>
              </div>
              <p className="mt-1 text-xs text-text-secondary">URL HTTPS que recebe os eventos das solicitações deste app.</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-stretch gap-2">
                <code className="flex-1 select-all overflow-x-auto rounded-md border border-border bg-surface-muted px-3 py-2.5 font-mono text-xs text-text-primary">
                  {app.webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(app.webhookUrl, "Webhook")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-text-tertiary" />
                <h2 className="text-base font-semibold text-text-primary">Chave de API</h2>
              </div>
              <p className="mt-1 text-xs text-text-secondary">A chave secreta foi exibida apenas no momento da criação do app.</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-text-primary">
                Formato esperado: <code className="font-mono text-xs bg-surface-muted px-1.5 py-0.5 rounded border border-border">{app.id}.&lt;secret&gt;</code>
              </p>
              <p className="mt-1 text-xs text-text-tertiary">A rotação de chaves estará disponível em breve.</p>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-trust/30 bg-trust/5 p-5">
            <div className="flex items-center gap-2 text-trust">
              <KeyRound className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Segurança</p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-text-secondary">
              <li>• A chave secreta não pode ser visualizada após a criação.</li>
              <li>• Caso suspeite de vazamento, recrie o app.</li>
              <li>• Use variáveis de ambiente — nunca commit no código.</li>
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}
