"use client";

import { Building2, LogOut, CreditCard, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { toast } from "sonner";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Perfil da empresa"
        description="Dados cadastrais da organização vinculada ao console YaID."
      />

      <section className="space-y-6">
        {/* Identificação */}
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-text-primary">Identificação</h2>
            <p className="text-xs text-text-secondary">
              Informações usadas em contratos, faturas e logs de auditoria.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Acme Identidade Ltda.</p>
                <p className="text-xs text-text-secondary">Conta empresarial · Plano Business</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-text-secondary">Nome da empresa</label>
                <input
                  type="text"
                  defaultValue="Acme Identidade Ltda."
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">CNPJ</label>
                <input
                  type="text"
                  defaultValue="12.345.678/0001-90"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Razão social</label>
                <input
                  type="text"
                  defaultValue="Acme Identidade Ltda."
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-text-secondary">E-mail de contato</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    defaultValue="contato@acme.com.br"
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                  />
                  <StatusBadge status="approved" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => toast.success("Alterações salvas com sucesso")}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-text-primary">Payment</h2>
            <p className="text-xs text-text-secondary">
              Gerencie sua assinatura, métodos de pagamento e faturas no portal da Stripe.
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-trust/10 text-trust">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">Portal de cobrança Stripe</p>
                <p className="text-xs text-text-tertiary">
                  Você será redirecionado para o ambiente seguro da Stripe.
                </p>
              </div>
            </div>
            <a
              href="https://billing.stripe.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Abrir Stripe <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Sair */}
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem("yaid:session");
            window.localStorage.removeItem("yaid:apps");
            window.location.href = "/sign-in";
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-error-border bg-error-bg px-6 py-5 text-sm font-semibold text-error-text shadow-card transition-colors hover:bg-error-bg/80"
        >
          <LogOut className="h-5 w-5" /> Sair da conta
        </button>
      </section>
    </>
  );
}
