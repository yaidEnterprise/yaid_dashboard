"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Info, ShieldCheck, KeyRound, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { createApp, type AppEnv, type YaidApp } from "@/lib/apps-store";

export default function CreateAppPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [env, setEnv] = useState<AppEnv>("sandbox");
  const [webhook, setWebhook] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [createdApp, setCreatedApp] = useState<YaidApp | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome do app");
      return;
    }
    if (webhook && !/^https:\/\//i.test(webhook.trim())) {
      toast.error("O webhook deve começar com https://");
      return;
    }
    setSubmitting(true);
    try {
      const { app, apiKey: key } = createApp({ name, description, env, webhook });
      setCreatedApp(app);
      setApiKey(key);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success("Chave copiada");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleFinish = () => {
    if (!confirmedSaved) return;
    router.push("/apps");
  };

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/apps" className="hover:text-text-primary">Apps</Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-text-primary">Novo app</span>
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
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Criar novo app
          </h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Configure um novo ponto de integração com a YaID. Após criar o app, você receberá uma chave secreta que deve ser armazenada com segurança.
          </p>
        </div>
      </div>

      {/* Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2">
          {/* Identificação */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Identificação</h2>
              <p className="text-xs text-text-secondary">Como esse app aparece para sua equipe.</p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Nome do app</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex.: Onboarding Produção"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                />
                <p className="text-[11px] text-text-tertiary">Visível apenas para sua equipe.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Descrição</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o uso desse app dentro da sua operação."
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                />
              </div>
            </div>
          </div>

          {/* Ambiente */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Ambiente</h2>
              <p className="text-xs text-text-secondary">Selecione onde este app vai operar.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-2">
              {[
                { env: "sandbox" as const, title: "Sandbox", desc: "Para testes, homologação e desenvolvimento. Sem custo." },
                { env: "production" as const, title: "Production", desc: "Validações reais com usuários finais. Sujeito a cobrança." },
              ].map((opt) => (
                <label
                  key={opt.env}
                  className="flex cursor-pointer flex-col gap-2 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong has-[:checked]:border-trust has-[:checked]:bg-trust/5"
                >
                  <div className="flex items-center justify-between">
                    <EnvBadge env={opt.env} />
                    <input
                      type="radio"
                      name="env"
                      checked={env === opt.env}
                      onChange={() => setEnv(opt.env)}
                      className="h-4 w-4 accent-trust"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{opt.title}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Webhook */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Webhook</h2>
              <p className="text-xs text-text-secondary">URL HTTPS que receberá os eventos das solicitações.</p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">URL do webhook</label>
                <input
                  type="url"
                  value={webhook}
                  onChange={(e) => setWebhook(e.target.value)}
                  placeholder="https://api.suaempresa.com/yaid/hooks"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                />
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/apps"
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Criando..." : "Criar app"}
            </button>
          </div>
        </form>

        {/* Aside */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-trust/30 bg-trust/5 p-5">
            <div className="flex items-center gap-2 text-trust">
              <Info className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Antes de criar</p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-text-secondary">
              <li>• Apps de produção exigem domínio verificado para o webhook.</li>
              <li>• A chave secreta será exibida uma única vez após a criação.</li>
              <li>• Você pode revogar e rotacionar a chave a qualquer momento.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-privacy/30 bg-privacy/5 p-5">
            <div className="flex items-center gap-2 text-privacy">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Privacidade</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              A YaID nunca compartilha documentos brutos. Cada app recebe apenas os atributos confirmados pelo usuário.
            </p>
          </div>
        </aside>
      </section>

      {/* Modal de chave secreta - bloqueante */}
      {mounted && createdApp && apiKey && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onKeyDown={(e) => {
            if (e.key === "Escape") e.preventDefault();
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
            <div className="flex items-start gap-3 border-b border-border px-6 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-trust/10 text-trust">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 id="api-key-title" className="text-base font-semibold text-text-primary">
                  Sua chave secreta
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary">
                  App <span className="font-medium text-text-primary">{createdApp.name}</span> criado com sucesso.
                </p>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="flex items-start gap-3 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-warning-text">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold">Esta é a única vez que você verá esta chave.</p>
                  <p className="mt-0.5">
                    Copie e armazene em local seguro (gerenciador de segredos). Se perder, será preciso rotacionar.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Secret key</label>
                <div className="flex items-stretch gap-2">
                  <code className="flex-1 select-all overflow-x-auto rounded-md border border-border bg-surface-muted px-3 py-2.5 font-mono text-xs text-text-primary">
                    {apiKey}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-success-text" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-muted/50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={confirmedSaved}
                  onChange={(e) => setConfirmedSaved(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-trust"
                />
                <span className="text-xs leading-relaxed text-text-primary">
                  Eu copiei a chave e armazenei em um local seguro. Entendo que ela não será exibida novamente.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-muted/30 px-6 py-4">
              <button
                type="button"
                onClick={handleFinish}
                disabled={!confirmedSaved}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Concluir e ir para Apps
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
