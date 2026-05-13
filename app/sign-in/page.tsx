"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldHalf, Loader2, AlertCircle, Code2, Lock, Zap, FlaskConical } from "lucide-react";
import { getSupabaseBrowserClient } from "@/shared/clients/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }

    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/companies/me", { cache: "no-store" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      window.location.href = "/onboarding/company";
    }
  }

  const featureCards = [
    {
      Icon: Code2,
      title: "API simples",
      description: "Uma única chamada para criar uma validação de personhood.",
    },
    {
      Icon: Lock,
      title: "Sem dados sensíveis",
      description: "A empresa recebe apenas o resultado, nunca dados pessoais.",
    },
    {
      Icon: Zap,
      title: "Webhooks em tempo real",
      description: "Receba resultados automaticamente via webhook.",
    },
    {
      Icon: FlaskConical,
      title: "Sandbox para testes",
      description: "Ambiente seguro para testar antes de operar em produção.",
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <ShieldHalf className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight text-text-primary">YaID</span>
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Acesse sua conta
          </h1>
          <p className="mb-8 text-sm text-text-secondary">
            Gerencie suas integrações de validação de identidade com a YaID.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-primary">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-text-primary">
                  Senha
                </label>
                <a href="#" className="text-xs font-medium text-trust hover:text-trust/80">
                  Esqueci minha senha
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-error-border bg-error-bg px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-error-text" />
                <span className="text-sm text-error-text">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Não tem conta?{" "}
            <Link href="/onboarding/company" className="font-medium text-trust hover:text-trust/80">
              Cadastre sua empresa
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Institutional */}
      <div className="relative hidden flex-col justify-center overflow-hidden bg-primary p-12 lg:flex lg:w-[480px] xl:w-[540px] xl:p-16">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          <div className="absolute bottom-0 left-0 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-white" />
        </div>

        <div className="relative">
          <h2 className="mb-3 text-2xl font-bold leading-tight text-white xl:text-3xl">
            Validação de identidade{" "}
            <span className="text-trust-foreground/80">simples e segura</span>{" "}
            para empresas
          </h2>
          <p className="mb-10 max-w-sm text-sm text-white/60">
            Integre a verificação de personhood ao seu produto com poucos cliques.
          </p>

          <div className="grid grid-cols-1 gap-3">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-trust/20 text-trust-foreground">
                  <card.Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="mb-0.5 text-sm font-semibold text-white">{card.title}</h3>
                  <p className="text-xs leading-relaxed text-white/50">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
