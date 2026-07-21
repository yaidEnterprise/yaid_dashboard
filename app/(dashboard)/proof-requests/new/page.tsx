"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/shared/copy-button";
import { InlineCode } from "@/components/api/code-block";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { listApps, type YaidApp } from "@/utils/apps-store";
import { fetchWithAuth } from "@/utils/fetch-with-auth";

type ProofType = "personhood" | "age_over_18";

type CreatedProofRequest = {
  id: string;
  verificationUrl: string;
  session: { verificationUrl: string };
};

export default function NewProofRequestPage() {
  const [apps, setApps] = useState<YaidApp[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [proofType, setProofType] = useState<ProofType>("personhood");
  const [externalReference, setExternalReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<CreatedProofRequest | null>(null);

  useEffect(() => {
    let cancelled = false;

    listApps()
      .then((items) => {
        if (cancelled) return;
        setApps(items.filter((app) => app.status === "enabled"));
        setAppsError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setAppsError(e.message);
      })
      .finally(() => !cancelled && setHydrated(true));

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAppId) {
      setError("Selecione um app ativo para continuar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithAuth("/api/proof-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: selectedAppId,
          proofType: proofType,
          externalReference: externalReference.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Não foi possível criar a proof request.");
      }

      setCreatedRequest({
        id: payload.id,
        verificationUrl: payload.session?.verificationUrl || payload.verificationUrl || "",
        session: payload.session,
      });
      toast.success("Proof request criada com sucesso!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar a proof request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/proof-requests" className="hover:text-text-primary">
          Proof Requests
        </Link>
        <span className="text-text-tertiary">/</span>
        <span className="text-text-primary">Nova solicitação</span>
      </nav>

      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <Link
          href="/proof-requests"
          className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          ← Voltar para lista
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Criar solicitação</h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Crie uma proof request diretamente pelo dashboard e copie a URL gerada para validar a integração.
        </p>
      </div>

      {!hydrated ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-trust" />
        </div>
      ) : appsError ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-error-text">
          {appsError}
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">Nenhum app ativo encontrado.</p>
          <Link
            href="/apps/new"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-trust hover:underline"
          >
            Criar um app primeiro <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-surface p-6 shadow-card">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Dados da solicitação</h2>
              <p className="text-sm text-text-secondary">
                Escolha um app ativo, defina o tipo de prova e envie a solicitação para o fluxo de verificação.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="app" className="text-sm font-medium text-text-secondary">
                App
              </label>
              <select
                id="app"
                value={selectedAppId}
                onChange={(event) => setSelectedAppId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
              >
                <option value="">Selecione um app</option>
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name} ({app.environment})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="proofType" className="text-sm font-medium text-text-secondary">
                Tipo de prova
              </label>
              <select
                id="proofType"
                value={proofType}
                onChange={(event) => setProofType(event.target.value as ProofType)}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
              >
                <option value="personhood">Personhood</option>
                <option value="age_over_18">Maior de 18 anos</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="externalReference" className="text-sm font-medium text-text-secondary">
                Referência externa (opcional)
              </label>
              <input
                id="externalReference"
                type="text"
                value={externalReference}
                onChange={(event) => setExternalReference(event.target.value)}
                placeholder="Ex.: order_123"
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {isSubmitting ? "Criando..." : "Criar proof request"}
            </button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
              <div className="flex items-center gap-2 text-trust">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Fluxo</span>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                A criação usa o endpoint interno autenticado por sessão do dashboard e gera uma URL de verificação para o usuário final.
              </p>
            </div>

            {createdRequest ? (
              <div className="rounded-lg border border-trust/30 bg-trust/5 p-5 shadow-card">
                <p className="text-sm font-semibold text-text-primary">Solicitação criada</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Request ID</p>
                    <InlineCode copyable>{createdRequest.id}</InlineCode>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Verification URL</p>
                    <div className="mt-1 flex items-center gap-2">
                      <InlineCode copyable className="max-w-[240px]">
                        {createdRequest.verificationUrl}
                      </InlineCode>
                      <CopyButton value={createdRequest.verificationUrl} label="Copiar" variant="inline" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </section>
      )}
    </>
  );
}
