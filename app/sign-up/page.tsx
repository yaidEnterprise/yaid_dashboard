"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Code2, Lock, Zap, FlaskConical } from "lucide-react";
import { getSupabaseBrowserClient } from "@/shared/clients/supabase/client";

const signUpSchema = z
  .object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Mínimo de 8 caracteres"),
    confirmPassword: z.string(),
    companyName: z
      .string()
      .min(1, "Nome da empresa é obrigatório")
      .max(50, "Máximo de 50 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function SignUpPage() {
  const router = useRouter();
  const [cnpjDisplay, setCnpjDisplay] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
  });

  async function onSubmit(data: SignUpFormData) {
    const rawCnpj = cnpjDisplay.replace(/\D/g, "") || undefined;

    if (!rawCnpj || rawCnpj.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }

    const res = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.companyName,
        cnpj: rawCnpj,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        typeof body.error === "string"
          ? body.error
          : body.error?.message ?? "Erro ao criar conta. Tente novamente.";
      toast.error(message);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError) {
      toast.error("Conta criada! Faça login para continuar.");
      router.push("/sign-in");
      return;
    }

    router.push("/");
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
      description: "Ambiente seguro para testes antes de operar em produção.",
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="mb-10 flex items-center">
            <div className="flex h-12 w-12 items-center justify-center">
              <Image src="/yaid_icon.svg" alt="YaID" width={48} height={48} className="h-12 w-12 object-contain" />
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Crie sua conta
          </h1>
          <p className="mb-8 text-sm text-text-secondary">
            Cadastre sua empresa e comece a integrar com a YaID.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                {...register("password")}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirmação de senha */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Confirme a senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Nome da empresa */}
            <div>
              <label
                htmlFor="companyName"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Nome da empresa
              </label>
              <input
                id="companyName"
                type="text"
                placeholder="Razão social ou nome fantasia"
                autoComplete="organization"
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                {...register("companyName")}
              />
              {errors.companyName && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.companyName.message}
                </p>
              )}
            </div>

            {/* CNPJ */}
            <div>
              <label
                htmlFor="cnpj"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                CNPJ
              </label>
              <input
                id="cnpj"
                type="text"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={cnpjDisplay}
                onChange={(e) => setCnpjDisplay(formatCNPJ(e.target.value))}
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando conta…
                </>
              ) : (
                "Criar conta"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Já tem conta?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-trust hover:text-trust/80"
            >
              Faça login
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Institutional */}
      <div className="relative hidden flex-col justify-center overflow-hidden bg-primary p-12 lg:flex lg:w-[480px] xl:w-[540px] xl:p-16">
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
            Integre a verificação de personhood ao seu produto com poucos
            cliques.
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
                  <h3 className="mb-0.5 text-sm font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-white/50">
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
