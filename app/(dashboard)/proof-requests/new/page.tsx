"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Clock,
  QrCode,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { getApps, type YaidApp } from "@/lib/apps-store";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { StatusBadge } from "@/components/feedback/status-badge";
import { InlineCode } from "@/components/api/code-block";

type SimStep = "select-app" | "configure" | "waiting" | "result";

export default function NewProofRequestPage() {
  const [apps, setApps] = useState<YaidApp[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [selectedApp, setSelectedApp] = useState<YaidApp | null>(null);
  const [proofType] = useState("personhood");
  const [externalRef, setExternalRef] = useState("");
  const [step, setStep] = useState<SimStep>("select-app");

  // Simulation result
  const [requestId, setRequestId] = useState("");
  const [sessionUrl, setSessionUrl] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [resultStatus, setResultStatus] = useState<"approved" | "rejected">("approved");

  useEffect(() => {
    setApps(getApps().filter((a) => a.status === "active"));
    setHydrated(true);
  }, []);

  function handleSelectApp(app: YaidApp) {
    setSelectedApp(app);
    setStep("configure");
  }

  function handleCreateRequest() {
    if (!selectedApp) return;

    // Simulate creating a proof request
    const id = `prq_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
    const token = `sess_${Math.random().toString(36).substring(2, 14)}`;
    setRequestId(id);
    setSessionUrl(`${window.location.origin}/v/${token}`);
    setStep("waiting");
    setCountdown(10);

    toast.success("Proof request criada com sucesso!");
  }

  // Countdown timer for "waiting" step
  useEffect(() => {
    if (step !== "waiting") return;
    if (countdown <= 0) {
      setResultStatus(Math.random() > 0.2 ? "approved" : "rejected");
      setStep("result");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown]);

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/proof-requests" className="hover:text-text-primary">Proof Requests</Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-text-primary">Nova solicitação</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <Link
          href="/proof-requests"
          className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Voltar para lista
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Criar solicitação
        </h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Simule o fluxo completo de uma verificação de identidade. Selecione um app, configure os parâmetros e acompanhe o resultado em tempo real.
        </p>
      </div>

      {/* Step 1: Select App */}
      {step === "select-app" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">1. Selecione o app</h2>
            <p className="text-sm text-text-secondary">Escolha qual app emitirá a solicitação de prova.</p>
          </div>

          {!hydrated ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-trust" />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => handleSelectApp(app)}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-all hover:border-trust hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{app.name}</span>
                    <EnvBadge env={app.env} />
                  </div>
                  {app.description && (
                    <span className="text-xs text-text-secondary line-clamp-2">{app.description}</span>
                  )}
                  <span className="text-[11px] text-text-tertiary">ID: {app.id}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step 2: Configure */}
      {step === "configure" && selectedApp && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">2. Configurar solicitação</h2>
              <p className="text-sm text-text-secondary">
                Defina os parâmetros da proof request para o app <strong>{selectedApp.name}</strong>.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface shadow-card">
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-base font-semibold text-text-primary">Parâmetros</h3>
              </div>
              <div className="space-y-5 px-6 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">App selecionado</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{selectedApp.name}</span>
                    <EnvBadge env={selectedApp.env} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Tipo de prova</label>
                  <div className="flex items-center gap-3 rounded-md border border-trust/50 bg-trust/5 p-3">
                    <ShieldCheck className="h-5 w-5 text-trust" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">Personhood</p>
                      <p className="text-xs text-text-secondary">Confirma que o usuário é uma pessoa real.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Referência externa (opcional)</label>
                  <input
                    type="text"
                    value={externalRef}
                    onChange={(e) => setExternalRef(e.target.value)}
                    placeholder="Ex.: user_12345 ou order_abc"
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                  />
                  <p className="text-[11px] text-text-tertiary">ID interno do seu sistema para rastrear esta solicitação.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedApp(null);
                  setStep("select-app");
                }}
                className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCreateRequest}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Criar proof request
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Aside */}
          <aside className="space-y-4">
            <div className="rounded-lg border border-privacy/30 bg-privacy/5 p-5">
              <div className="flex items-center gap-2 text-privacy">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-wider">Simulação</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                Esta é uma simulação local. Em produção, proof requests são criadas via API com a chave secreta do app.
              </p>
            </div>
          </aside>
        </section>
      )}

      {/* Step 3: Waiting for user */}
      {step === "waiting" && (
        <section className="flex flex-col items-center justify-center gap-6 py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-trust/10">
            <Smartphone className="h-10 w-10 text-trust animate-pulse" />
          </div>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-text-primary">Aguardando resposta do usuário</h2>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              Em um cenário real, o usuário abriria o link no app YaID e aprovaria o compartilhamento dos dados.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-6 py-4 shadow-card">
            <QrCode className="h-12 w-12 text-text-tertiary" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-text-secondary">URL da verificação</p>
              <InlineCode copyable>{sessionUrl}</InlineCode>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning-text" />
              <StatusBadge status="pending" />
            </div>
            <p className="text-sm text-text-tertiary">
              Simulando resposta em <span className="font-semibold text-text-primary">{countdown}s</span>…
            </p>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-trust transition-all duration-1000"
                style={{ width: `${((10 - countdown) / 10) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <p className="text-xs font-medium text-text-secondary">Request ID</p>
            <InlineCode copyable>{requestId}</InlineCode>
          </div>
        </section>
      )}

      {/* Step 4: Result */}
      {step === "result" && (
        <section className="flex flex-col items-center justify-center gap-6 py-8">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${
            resultStatus === "approved" ? "bg-verified/10" : "bg-error-bg"
          }`}>
            {resultStatus === "approved" ? (
              <CheckCircle2 className="h-10 w-10 text-verified" />
            ) : (
              <ShieldCheck className="h-10 w-10 text-error-text" />
            )}
          </div>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-text-primary">
              {resultStatus === "approved" ? "Verificação concluída" : "Verificação rejeitada"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              {resultStatus === "approved"
                ? "O usuário confirmou sua identidade com sucesso. O webhook do app receberia o resultado automaticamente."
                : "O usuário rejeitou a solicitação ou ocorreu um erro na verificação."}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Request ID</span>
                <InlineCode copyable>{requestId}</InlineCode>
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">App</span>
                <span className="text-sm text-text-primary">{selectedApp?.name}</span>
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Tipo de prova</span>
                <span className="text-sm capitalize text-text-primary">{proofType}</span>
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Status</span>
                <StatusBadge status={resultStatus} />
              </div>
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="text-xs font-medium text-text-secondary">Resultado</span>
                <span className={`text-sm font-medium ${resultStatus === "approved" ? "text-verified" : "text-error-text"}`}>
                  {resultStatus === "approved" ? "true" : "false"}
                </span>
              </div>
              {externalRef && (
                <div className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-xs font-medium text-text-secondary">Ref. externa</span>
                  <span className="text-sm text-text-primary">{externalRef}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/proof-requests"
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              Voltar para lista
            </Link>
            <button
              type="button"
              onClick={() => {
                setSelectedApp(null);
                setStep("select-app");
                setRequestId("");
                setSessionUrl("");
                setExternalRef("");
                setCountdown(10);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Criar nova solicitação
            </button>
          </div>
        </section>
      )}
    </>
  );
}
