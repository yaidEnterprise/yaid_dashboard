"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronRight,
  ChevronLeft,
  Globe,
  KeyRound,
  Power,
  PowerOff,
  AlertTriangle,
  Loader2,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { getApp, updateApp, type YaidApp } from "@/utils/apps-store";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { CopyButton } from "@/components/shared/copy-button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const identSchema = z.object({
  name: z
    .string()
    .min(1, "Informe o nome do app")
    .max(50, "Máximo de 50 caracteres"),
});
type IdentValues = z.infer<typeof identSchema>;

const webhookSchema = z.object({
  webhookUrl: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === "" || /^https:\/\//i.test(v.trim()), {
      message: "O webhook deve começar com https://",
    }),
});
type WebhookValues = z.infer<typeof webhookSchema>;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
        <div className="flex items-center gap-3">
          <div className="h-8 w-48 animate-pulse rounded bg-surface-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-surface-muted" />
        </div>
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-surface shadow-card">
              <div className="border-b border-border px-6 py-4">
                <div className="h-5 w-32 animate-pulse rounded bg-surface-muted" />
              </div>
              <div className="px-6 py-5 space-y-3">
                <div className="h-10 animate-pulse rounded bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Disable Confirm Dialog ───────────────────────────────────────────────────

function DisableConfirmDialog({
  open,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmBtnRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onCancel();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disable-app-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface shadow-elevated">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-error-bg text-error-text">
            <PowerOff className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="disable-app-dialog-title"
              className="text-base font-semibold text-text-primary"
            >
              Desabilitar app
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              Novas proof requests usando este app serão rejeitadas. Apps
              existentes em andamento não serão afetados.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 bg-surface-muted/40 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
            {loading ? "Desabilitando..." : "Desabilitar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Identificação Card ────────────────────────────────────────────────────────

function IdentCard({
  app,
  onSaved,
}: {
  app: YaidApp;
  onSaved: (updated: YaidApp) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<IdentValues>({
    resolver: zodResolver(identSchema),
    defaultValues: { name: app.name },
  });

  // Reset when app changes (e.g., after status toggle updates the app)
  useEffect(() => {
    reset({ name: app.name });
  }, [app.name, reset]);

  const onSubmit = async (values: IdentValues) => {
    try {
      const updated = await updateApp(app.id, { name: values.name.trim() });
      onSaved(updated);
      reset({ name: updated.name });
      toast.success("Nome atualizado com sucesso");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao salvar o nome");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-text-tertiary" />
          <h2 className="text-base font-semibold text-text-primary">
            Identificação
          </h2>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Nome de exibição do app no dashboard.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="app-name"
            className="block text-xs font-medium text-text-secondary"
          >
            Nome do app
          </label>
          <input
            id="app-name"
            type="text"
            placeholder="Meu App"
            {...register("name")}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          {errors.name && (
            <p className="text-xs text-error-text">{errors.name.message}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {isDirty && (
            <button
              type="button"
              onClick={() => reset({ name: app.name })}
              disabled={isSubmitting}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Webhook Card ─────────────────────────────────────────────────────────────

function WebhookCard({
  app,
  onSaved,
}: {
  app: YaidApp;
  onSaved: (updated: YaidApp) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WebhookValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { webhookUrl: app.webhookUrl ?? "" },
  });

  useEffect(() => {
    reset({ webhookUrl: app.webhookUrl ?? "" });
  }, [app.webhookUrl, reset]);

  const onSubmit = async (values: WebhookValues) => {
    const webhookUrl = values.webhookUrl?.trim() ?? "";
    try {
      const updated = await updateApp(app.id, { webhookUrl });
      onSaved(updated);
      reset({ webhookUrl: updated.webhookUrl ?? "" });
      toast.success("Webhook atualizado com sucesso");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao salvar o webhook");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-text-tertiary" />
          <h2 className="text-base font-semibold text-text-primary">Webhook</h2>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          URL HTTPS que recebe os eventos das solicitações deste app. Opcional.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="webhook-url"
            className="block text-xs font-medium text-text-secondary"
          >
            URL do Webhook
          </label>
          <input
            id="webhook-url"
            type="url"
            placeholder="https://exemplo.com/webhook"
            {...register("webhookUrl")}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          {errors.webhookUrl && (
            <p className="text-xs text-error-text">
              {errors.webhookUrl.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {isDirty && (
            <button
              type="button"
              onClick={() => reset({ webhookUrl: app.webhookUrl ?? "" })}
              disabled={isSubmitting}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── API Key Card ─────────────────────────────────────────────────────────────

function ApiKeyCard({ app }: { app: YaidApp }) {
  // appId is the public identifier — appId mirrors app.id (see viewmodel)
  const publicId = app.appId || app.id;

  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-text-tertiary" />
          <h2 className="text-base font-semibold text-text-primary">
            Chave da API
          </h2>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          A chave secreta foi exibida apenas no momento da criação do app e não
          pode ser recuperada.
        </p>
      </div>
      <div className="px-6 py-5 space-y-4">
        {/* Public app_id */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">
            Identificador público (app_id)
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 select-all overflow-x-auto rounded-md border border-border bg-surface-muted px-3 py-2.5 font-mono text-xs text-text-primary">
              {publicId}
            </code>
            <CopyButton value={publicId} label="Copiar" copiedLabel="Copiado!" />
          </div>
        </div>

        {/* Format hint */}
        <p className="text-sm text-text-primary">
          Formato da API key:{" "}
          <code className="font-mono text-xs bg-surface-muted px-1.5 py-0.5 rounded border border-border">
            {publicId}.&lt;secret&gt;
          </code>
        </p>
        <p className="text-xs text-text-tertiary">
          A rotação de chaves estará disponível em breve.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppDetailPage() {
  const params = useParams();
  const appId = params.appId as string;

  const [app, setApp] = useState<YaidApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Disable dialog state
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
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

  async function handleDisableConfirm() {
    if (!app) return;
    setToggling(true);
    try {
      const updated = await updateApp(app.id, { status: "disabled" });
      setApp(updated);
      toast.success("App desabilitado");
      setDisableDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao desabilitar o app");
    } finally {
      setToggling(false);
    }
  }

  async function handleEnable() {
    if (!app) return;
    setToggling(true);
    try {
      const updated = await updateApp(app.id, { status: "enabled" });
      setApp(updated);
      toast.success("App reabilitado");
    } catch (e) {
      toast.error((e as Error).message || "Falha ao reabilitar o app");
    } finally {
      setToggling(false);
    }
  }

  function handleToggle() {
    if (!app) return;
    if (app.status === "enabled") {
      setDisableDialogOpen(true);
    } else {
      handleEnable();
    }
  }

  // ── Loading ──
  if (loading) {
    return <PageSkeleton />;
  }

  // ── Error / Not Found ──
  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold text-text-primary">
          App não encontrado
        </p>
        <p className="text-sm text-text-secondary">
          {error || (
            <>
              O identificador{" "}
              <code className="font-mono text-xs bg-surface-muted px-1.5 py-0.5 rounded">
                {appId}
              </code>{" "}
              não corresponde a nenhum app.
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/apps" className="hover:text-text-primary">
          Apps
        </Link>
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              {app.name}
            </h1>
            <StatusBadge status={app.status} size="md" />
            {app.environment && app.environment !== "dev" && (
              <EnvBadge env={app.environment} size="md" />
            )}
          </div>
          <p className="text-xs text-text-tertiary">
            Criado em {formatDate(app.createdAt)}
          </p>
        </div>

        {/* Status toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="toggle-status-btn"
            onClick={handleToggle}
            disabled={toggling}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            {toggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : app.status === "enabled" ? (
              <>
                <PowerOff className="h-4 w-4" /> Desabilitar
              </>
            ) : (
              <>
                <Power className="h-4 w-4" /> Reabilitar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identificação card */}
          <IdentCard app={app} onSaved={setApp} />

          {/* Webhook card */}
          <WebhookCard app={app} onSaved={setApp} />

          {/* Chave da API card */}
          <ApiKeyCard app={app} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-trust/30 bg-trust/5 p-5">
            <div className="flex items-center gap-2 text-trust">
              <KeyRound className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">
                Segurança
              </p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-text-secondary">
              <li>• A chave secreta não pode ser visualizada após a criação.</li>
              <li>• Caso suspeite de vazamento, recrie o app.</li>
              <li>• Use variáveis de ambiente — nunca commit no código.</li>
            </ul>
          </div>

          {app.status === "disabled" && (
            <div className="rounded-lg border border-warning-border bg-warning-bg p-5">
              <div className="flex items-center gap-2 text-warning-text">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-wider">
                  App desabilitado
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                Este app está desabilitado. Novas proof requests usando sua API
                key serão rejeitadas.
              </p>
            </div>
          )}
        </aside>
      </section>

      {/* Disable confirm dialog */}
      <DisableConfirmDialog
        open={disableDialogOpen}
        onCancel={() => setDisableDialogOpen(false)}
        onConfirm={handleDisableConfirm}
        loading={toggling}
      />
    </>
  );
}
