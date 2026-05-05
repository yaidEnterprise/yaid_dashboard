"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Send,
  FileCheck2,
  Eye,
} from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EnvBadge } from "@/components/feedback/environment-badge";
import { CodeBlock, InlineCode } from "@/components/api/code-block";

const timeline = [
  { label: "Created", time: "29 abr 2025 · 14:32:08", Icon: Send, done: true },
  { label: "Opened by user", time: "29 abr 2025 · 14:33:41", Icon: Eye, done: true },
  { label: "Submitted", time: "29 abr 2025 · 14:35:02", Icon: FileCheck2, done: true },
  { label: "Approved", time: "29 abr 2025 · 14:35:14", Icon: CheckCircle2, done: true },
];

const payload = `{
  "id": "prq_8f2a1c93b4d6",
  "app": "app_onboarding_prod",
  "type": "document_and_liveness",
  "status": "approved",
  "result": {
    "document_valid": true,
    "liveness_passed": true,
    "name_match": true,
    "age_over_18": true
  },
  "external_reference": "user_47d2",
  "created_at": "2025-04-29T14:32:08Z",
  "completed_at": "2025-04-29T14:35:14Z"
}`;

export default function ProofRequestDetailPage() {
  const params = useParams();
  const requestId = params.requestId as string;

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/proof-requests" className="hover:text-text-primary">
          Proof Requests
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="font-mono text-text-primary">{requestId}</span>
      </nav>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href="/proof-requests"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar para a lista
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Solicitação de validação
            </h1>
            <StatusBadge status="approved" size="md" />
            <EnvBadge env="prod" size="md" />
          </div>
          <div className="flex items-center gap-2">
            <InlineCode copyable>{requestId}</InlineCode>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Resumo */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Resumo</h2>
              <p className="text-xs text-text-secondary">
                A YaID apresenta apenas atributos confirmados. Documentos brutos não ficam disponíveis no dashboard.
              </p>
            </div>
            <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {[
                { k: "App", v: "Onboarding Produção" },
                { k: "Tipo", v: "Documento + Liveness" },
                { k: "Referência externa", v: "user_47d2", code: true },
                { k: "Criada em", v: "29 abr 2025 · 14:32:08" },
                { k: "Concluída em", v: "29 abr 2025 · 14:35:14" },
                { k: "Expira em", v: "—" },
              ].map((item) => (
                <div key={item.k} className="px-6 py-4">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                    {item.k}
                  </dt>
                  <dd className="mt-1.5 text-sm text-text-primary">
                    {item.code ? <InlineCode copyable>{item.v}</InlineCode> : item.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Atributos confirmados */}
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Atributos confirmados</h2>
                <p className="text-xs text-text-secondary">
                  O usuário aprovou o compartilhamento dos seguintes atributos.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-verified" />
            </div>
            <ul className="divide-y divide-border">
              {[
                { k: "Documento válido", v: "Confirmado" },
                { k: "Liveness", v: "Aprovado" },
                { k: "Nome confere com documento", v: "Sim" },
                { k: "Maior de 18 anos", v: "Sim" },
              ].map((a) => (
                <li key={a.k} className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-sm text-text-secondary">{a.k}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-text">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                    {a.v}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bloco técnico */}
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Resposta da API</h2>
              <p className="text-xs text-text-secondary">
                Payload enviado para o webhook configurado no app.
              </p>
            </div>
            <CodeBlock language="json" code={payload} />
          </div>

          {/* URL pública */}
          <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">URL de verificação</h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Link enviado ao usuário final para concluir a validação.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </button>
            </div>
            <div className="mt-3">
              <InlineCode copyable className="max-w-full">
                {`https://verify.yaid.app/r/${requestId.replace('prq_', '')}`}
              </InlineCode>
            </div>
          </div>
        </div>

        {/* Coluna lateral — timeline */}
        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Linha do tempo</h2>
              <p className="text-xs text-text-secondary">Eventos registrados nesta solicitação.</p>
            </div>
            <ol className="relative px-6 py-5">
              <span className="absolute left-[34px] top-7 bottom-7 w-px bg-border" aria-hidden />
              {timeline.map((ev) => (
                <li key={ev.label} className="relative flex gap-4 pb-5 last:pb-0">
                  <span
                    className={
                      ev.done
                        ? "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-success-border bg-success-bg text-success-text"
                        : "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-tertiary"
                    }
                  >
                    <ev.Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-text-primary">{ev.label}</p>
                    <p className="mt-0.5 text-xs text-text-tertiary tabular-nums">{ev.time}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-privacy/30 bg-privacy/5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-privacy">
              Privacidade
            </p>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              A empresa solicitou esta validação. O usuário aprovou o compartilhamento dos
              atributos exibidos acima. Documentos pessoais brutos permanecem sob controle do
              titular e não são acessíveis através do dashboard.
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
