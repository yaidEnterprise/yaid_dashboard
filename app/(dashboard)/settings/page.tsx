"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  LogOut,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { fetchWithAuth } from "@/utils/fetch-with-auth";

// ─── Types ──────────────────────────────────────────────────────────────────

type CompanyData = {
  id: string;
  name: string;
  cnpj: string | null;
  status: "active" | "inactive";
  createdAt: string;
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cnpj: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// Transforms the raw form values into the API payload shape
function toApiPayload(values: SettingsFormValues): { name: string; cnpj: string | null } {
  return {
    name: values.name,
    cnpj: values.cnpj === "" || values.cnpj === undefined ? null : values.cnpj,
  };
}

// ─── CNPJ mask ───────────────────────────────────────────────────────────────

function applyCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// ─── Logout dialog ───────────────────────────────────────────────────────────

function LogoutConfirmDialog({
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
      aria-labelledby="logout-dialog-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface shadow-elevated">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-error-bg text-error-text">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="logout-dialog-title"
              className="text-base font-semibold text-text-primary"
            >
              Sair da conta
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              Tem certeza que deseja encerrar sua sessão?
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
              <LogOut className="h-4 w-4" />
            )}
            {loading ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { name: "", cnpj: "" },
  });

  // Load company data
  useEffect(() => {
    fetchWithAuth("/api/companies/me")
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar dados da empresa.");
        return res.json() as Promise<CompanyData>;
      })
      .then((data) => {
        setCompany(data);
        reset({ name: data.name, cnpj: data.cnpj ?? "" });
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoadingData(false));
  }, [reset]);

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      const res = await fetchWithAuth("/api/companies/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toApiPayload(values)),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? "Falha ao salvar alterações."
        );
      }

      const updated = (await res.json()) as CompanyData;
      setCompany(updated);
      reset({ name: updated.name, cnpj: updated.cnpj ?? "" });
      toast.success("Alterações salvas com sucesso.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      // plain fetch: sign-out must never redirect on 401
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!res.ok) throw new Error("Não foi possível sair da conta.");
      window.location.replace("/sign-in");
    } catch (e) {
      toast.error((e as Error).message);
      setSigningOut(false);
      setLogoutDialogOpen(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <>
        <PageHeader
          title="Perfil da empresa"
          description="Dados cadastrais da organização vinculada ao console YaID."
        />
        <section className="space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg border border-border bg-surface"
            />
          ))}
        </section>
      </>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <>
        <PageHeader
          title="Perfil da empresa"
          description="Dados cadastrais da organização vinculada ao console YaID."
        />
        <div className="rounded-lg border border-error-border bg-error-bg px-6 py-5 text-sm text-error-text">
          {loadError}
        </div>
      </>
    );
  }

  // ── Populated ──────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Perfil da empresa"
        description="Dados cadastrais da organização vinculada ao console YaID."
      />

      <section className="space-y-6">
        {/* ── Identificação ─────────────────────────────────────────────── */}
        <form
          id="settings-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">
                Identificação
              </h2>
              <p className="text-xs text-text-secondary">
                Informações usadas em contratos, faturas e logs de auditoria.
              </p>
            </div>
            <div className="space-y-5 px-6 py-5">
              {/* Company avatar */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {company?.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Conta empresarial
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Nome */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label
                    htmlFor="settings-name"
                    className="text-xs font-medium text-text-secondary"
                  >
                    Nome da empresa
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    {...register("name")}
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-error-text">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* CNPJ */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="settings-cnpj"
                    className="text-xs font-medium text-text-secondary"
                  >
                    CNPJ{" "}
                    <span className="text-text-tertiary">(opcional)</span>
                  </label>
                  <input
                    id="settings-cnpj"
                    type="text"
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    {...register("cnpj")}
                    onChange={(e) => {
                      const masked = applyCnpjMask(e.target.value);
                      setValue("cnpj", masked);
                    }}
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                  />
                  {errors.cnpj && (
                    <p className="text-[11px] text-error-text">
                      {errors.cnpj.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  form="settings-form"
                  disabled={isSubmitting}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {isSubmitting ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* ── Payment (placeholder) ────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-text-primary">
              Pagamento
            </h2>
            <p className="text-xs text-text-secondary">
              Gerencie sua assinatura, métodos de pagamento e faturas no portal
              da Stripe.
            </p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-trust/10 text-trust">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Portal de cobrança Stripe
                </p>
                <p className="text-xs text-text-tertiary">
                  Você será redirecionado para o ambiente seguro da Stripe.
                </p>
              </div>
            </div>
            {/* Placeholder — Stripe não está integrado no MVP */}
            <button
              type="button"
              disabled
              className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border bg-surface-muted px-4 text-sm font-medium text-text-tertiary"
              title="Integração com Stripe disponível em breve"
            >
              Abrir Stripe <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Logout ───────────────────────────────────────────────────── */}
        <button
          id="settings-logout-btn"
          type="button"
          onClick={() => setLogoutDialogOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-error-border bg-error-bg px-6 py-5 text-sm font-semibold text-error-text shadow-card transition-colors hover:bg-error-bg/80"
        >
          <LogOut className="h-5 w-5" /> Sair da conta
        </button>
      </section>

      {/* ── Logout confirmation dialog ───────────────────────────────────── */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onCancel={() => setLogoutDialogOpen(false)}
        onConfirm={handleLogout}
        loading={signingOut}
      />
    </>
  );
}
