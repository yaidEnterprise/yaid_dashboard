import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, EyeOff, ShieldCheck, Webhook, X } from "lucide-react";

export const metadata: Metadata = {
  title: "YaID — Verificação de identidade sem coletar documentos",
  description:
    "A YaID confirma a identidade das pessoas que sua empresa precisa verificar e devolve apenas o resultado da validação — sem documentos brutos e sem dados pessoais do titular passando pela sua base.",
};

const steps = [
  {
    step: "01",
    title: "Solicite",
    body: "Seu backend cria a solicitação de verificação e recebe de volta o endereço da sessão para onde a pessoa deve ser levada.",
  },
  {
    step: "02",
    title: "Usuário confirma",
    body: "A pessoa abre a sessão, vê exatamente o que está sendo pedido e decide se aceita compartilhar antes de qualquer coisa sair do celular dela.",
  },
  {
    step: "03",
    title: "YaID verifica",
    body: "A checagem acontece do lado da YaID, a partir das credenciais que a própria pessoa apresenta na sessão.",
  },
  {
    step: "04",
    title: "Receba o resultado",
    body: "Sua aplicação é notificada pelo webhook configurado e segue o fluxo — libera o cadastro, o pedido ou o acesso.",
  },
];

const receives = [
  "O resultado da validação: aprovada ou reprovada.",
  "O identificador da verificação, para conciliar com o seu próprio registro.",
  "Uma notificação no webhook do seu app assim que o resultado sai.",
];

const doesNotReceive = [
  "Documentos brutos: nenhuma foto, PDF ou selfie chega até vocês.",
  "Dados pessoais do titular que a verificação não exigiu.",
  "A obrigação de armazenar e proteger material sensível de terceiros.",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-6 sm:h-16">
          <Image
            src="/yaid_logo.svg"
            alt="YaID"
            width={63}
            height={44}
            priority
            className="h-9 w-auto object-contain sm:h-11"
          />

          <nav aria-label="Navegação principal" className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/docs"
              className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Documentação
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="hidden rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:inline-flex"
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-6 pb-24">
        {/* ── Hero + trilha ───────────────────────────────────────────── */}
        <section
          aria-labelledby="proposta"
          className="grid grid-cols-1 gap-12 pt-16 lg:grid-cols-12 lg:gap-12 lg:pt-24"
        >
          <div className="lg:col-span-7">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-trust">
              Verificação de identidade para empresas
            </p>
            <h1
              id="proposta"
              className="mt-4 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-text-primary sm:text-5xl"
            >
              Confirme quem importa.
              <span className="block text-text-secondary">Sem coletar o que não precisa.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-text-secondary">
              A YaID faz a verificação de identidade no lugar da sua empresa e devolve só o que
              interessa para a sua decisão. A pessoa apresenta as credenciais dela; vocês recebem o
              resultado da validação e seguem em frente.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Criar conta
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Ver a documentação
              </Link>
            </div>

            <p className="mt-6 inline-flex max-w-xl items-start gap-2 text-sm leading-relaxed text-privacy">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Sua empresa recebe o resultado da validação — nunca os documentos brutos nem os
                dados pessoais do titular.
              </span>
            </p>
          </div>

          {/* Trilha contínua — Como funciona */}
          <section
            aria-labelledby="como-funciona"
            className="lg:col-span-5 lg:pt-2"
          >
            <div className="rounded-lg border border-border bg-surface p-6 shadow-card sm:p-7">
              <h2
                id="como-funciona"
                className="text-sm font-semibold tracking-tight text-text-primary"
              >
                Como funciona
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                Quatro etapas, sempre nesta ordem.
              </p>

              <ol className="mt-7 border-l border-border">
                {steps.map((item) => (
                  <li key={item.step} className="relative pb-7 pl-8 last:pb-0">
                    <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface font-mono text-xs font-semibold text-trust shadow-card">
                      {item.step}
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{item.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </section>

        {/* ── O que a sua empresa recebe ──────────────────────────────── */}
        <section aria-labelledby="privacidade" className="mt-24 scroll-mt-24">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-privacy">
            Limite de dados
          </p>
          <h2
            id="privacidade"
            className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
          >
            O que sai da verificação — e o que nunca sai
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            Dado que você não recebe é dado que você não precisa guardar, proteger nem justificar
            depois. A separação abaixo é o contrato da plataforma.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Check aria-hidden="true" className="h-4 w-4 text-verified" />
                Sua empresa recebe
              </h3>
              <ul className="mt-4 space-y-3">
                {receives.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-text-secondary">
                    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-verified" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-surface-muted p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <EyeOff aria-hidden="true" className="h-4 w-4 text-text-tertiary" />
                Sua empresa não recebe
              </h3>
              <ul className="mt-4 space-y-3">
                {doesNotReceive.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-text-secondary">
                    <X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Integração ──────────────────────────────────────────────── */}
        <section aria-labelledby="integracao" className="mt-24 scroll-mt-24">
          <div className="rounded-lg border border-border bg-surface p-7 shadow-card sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-trust">
                  Integração
                </p>
                <h2
                  id="integracao"
                  className="mt-3 text-2xl font-bold tracking-tight text-text-primary"
                >
                  Uma chamada para pedir, um webhook para saber
                </h2>
                <p className="mt-4 text-base leading-relaxed text-text-secondary">
                  Você cria a conta da empresa, cria um app, guarda a chave de API e integra. Cada
                  app tem seu próprio ambiente de homologação para você exercitar o fluxo ponta a
                  ponta antes de ir para produção.
                </p>
                <Link
                  href="/docs"
                  className="mt-6 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-trust underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Ler o guia de integração
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>

              <ul className="grid shrink-0 gap-3 sm:grid-cols-2 lg:w-80 lg:grid-cols-1">
                <li className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
                  <Webhook aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-trust" />
                  <span className="text-sm leading-relaxed text-text-secondary">
                    Webhook por app, com a URL que você definir.
                  </span>
                </li>
                <li className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-privacy" />
                  <span className="text-sm leading-relaxed text-text-secondary">
                    Chave de API exibida uma única vez, na criação do app.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Fechamento ──────────────────────────────────────────────── */}
        <section aria-labelledby="comecar" className="mt-24 scroll-mt-24 text-center">
          <h2
            id="comecar"
            className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
          >
            Comece pela conta da sua empresa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-secondary">
            O cadastro leva um minuto e já libera o dashboard. A criação de apps é liberada pelo
            time YaID junto com você.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Criar conta
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Já tenho conta
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/yaid_icon.svg"
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
            <span className="text-xs text-text-tertiary">
              YaID — verificação de identidade para empresas.
            </span>
          </div>
          <nav aria-label="Links do rodapé" className="flex items-center gap-5">
            <Link
              href="/docs"
              className="rounded-md text-xs font-medium text-text-secondary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Documentação
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md text-xs font-medium text-text-secondary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md text-xs font-medium text-text-secondary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
