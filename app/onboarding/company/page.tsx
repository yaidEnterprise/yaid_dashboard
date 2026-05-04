"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldHalf, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Nome da empresa é obrigatório.";
    if (!responsibleName.trim()) newErrors.responsibleName = "Nome do responsável é obrigatório.";
    if (!termsAccepted) newErrors.terms = "Aceite os termos para continuar.";
    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    // Simulate company creation — will be replaced with API call
    await new Promise((r) => setTimeout(r, 800));
    toast.success("Empresa criada com sucesso!");
    router.push("/apps/new");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-3xl flex-col gap-8 lg:flex-row">
        {/* Form Card */}
        <div className="flex-1 rounded-2xl border border-border bg-surface p-8 shadow-card">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ShieldHalf className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight text-text-primary">YaID</span>
          </div>

          <h1 className="mb-1 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
            Cadastre sua empresa
          </h1>
          <p className="mb-8 text-sm text-text-secondary">
            Cadastre sua organização para começar a criar apps, configurar webhooks e gerar solicitações de validação de personhood.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="company-name" className="mb-1.5 block text-sm font-medium text-text-primary">
                Nome da empresa <span className="text-destructive">*</span>
              </label>
              <input
                id="company-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: XPTO Tecnologia"
                className={`h-11 w-full rounded-lg border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-trust/20 ${
                  errors.name ? "border-destructive focus:border-destructive" : "border-border focus:border-trust"
                }`}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="document-number" className="mb-1.5 block text-sm font-medium text-text-primary">
                CNPJ <span className="text-text-tertiary">(opcional)</span>
              </label>
              <input
                id="document-number"
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
              />
            </div>

            <div>
              <label htmlFor="responsible-name" className="mb-1.5 block text-sm font-medium text-text-primary">
                Nome do responsável <span className="text-destructive">*</span>
              </label>
              <input
                id="responsible-name"
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Ex: João Silva"
                className={`h-11 w-full rounded-lg border bg-surface px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-trust/20 ${
                  errors.responsibleName ? "border-destructive focus:border-destructive" : "border-border focus:border-trust"
                }`}
              />
              {errors.responsibleName && (
                <p className="mt-1 text-xs text-destructive">{errors.responsibleName}</p>
              )}
            </div>

            <div className="flex items-start gap-3 pt-2">
              <input
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-trust"
              />
              <label htmlFor="terms" className="text-sm text-text-secondary">
                Li e aceito os{" "}
                <a href="#" className="font-medium text-trust hover:text-trust/80">
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a href="#" className="font-medium text-trust hover:text-trust/80">
                  Política de Privacidade
                </a>
                .
              </label>
            </div>
            {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando…
                  </>
                ) : (
                  "Criar empresa"
                )}
              </button>
              <Link
                href="/sign-in"
                className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Cancelar
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Já tem uma conta?{" "}
            <Link href="/sign-in" className="font-medium text-trust hover:text-trust/80">
              Faça login
            </Link>
          </p>
        </div>

        {/* Info Card */}
        <div className="hidden lg:block lg:w-[280px]">
          <div className="sticky top-8 rounded-2xl border border-trust/20 bg-trust/5 p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-trust/10">
              <Info className="h-5 w-5 text-trust" />
            </div>
            <h3 className="mb-2 text-sm font-semibold text-text-primary">Próximos passos</h3>
            <ol className="space-y-3 text-xs text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-trust text-[10px] font-bold text-white">1</span>
                Cadastre sua empresa
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-text-tertiary">2</span>
                Crie seu primeiro app
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-text-tertiary">3</span>
                Copie sua API key
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-text-tertiary">4</span>
                Integre e valide
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
