import { Clock, Loader2, CheckCircle2, XCircle, Lock, WifiOff } from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatProofType } from "@/utils/proof-requests-store";
import { DeepLinkButton } from "./deep-link-button";

export type VerificationDisplayStatus =
  | "waiting_user"
  | "opened"
  | "approved_by_user"
  | "cancelled"
  | "expired"
  | "invalid"
  | "network";

const KNOWN_STATUSES: VerificationDisplayStatus[] = [
  "waiting_user",
  "opened",
  "approved_by_user",
  "cancelled",
  "expired",
  "invalid",
  "network",
];

interface VerificationStateCardProps {
  status: VerificationDisplayStatus;
  sessionToken: string;
  companyName?: string;
  proofType?: string;
  secondsRemaining?: number;
  returnUrl?: string | null;
  onOpenApp?: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function VerificationStateCard({
  status,
  sessionToken,
  companyName,
  proofType,
  secondsRemaining = 0,
  returnUrl,
  onOpenApp,
}: VerificationStateCardProps) {
  return (
    <div>
      {status === "waiting_user" && (
        <div>
          {/* Only the state announcement lives inside the live region — the
              per-second countdown below is excluded so screen readers don't
              re-announce it every tick. */}
          <div role="status" aria-live="polite">
            <StatusBadge status="pending" label="Aguardando" size="md" />
            <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">
              Confirme sua identidade com YaID
            </h1>
            <p className="mb-6 text-sm text-text-secondary">
              {companyName ?? "A empresa parceira"} está solicitando{" "}
              {proofType ? formatProofType(proofType) : "uma validação de identidade"}.
            </p>
          </div>

          <div className="mb-6 space-y-2 rounded-xl bg-surface-muted p-4 text-left">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-text-tertiary">Expira em</span>
              <span className="font-medium text-text-primary">
                {formatCountdown(secondsRemaining)}
              </span>
            </div>
          </div>

          <DeepLinkButton sessionToken={sessionToken} onOpen={onOpenApp} />

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-privacy" strokeWidth={1.8} />
              <p className="text-left text-[11px] leading-relaxed text-text-tertiary">
                A YaID confirma apenas o resultado da validação. Seus documentos pessoais não
                são enviados para a empresa parceira.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "opened" && (
        <div role="status" aria-live="polite">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-trust" strokeWidth={2} />
          <StatusBadge status="processing" label="Em andamento" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">
            Aguardando confirmação no app
          </h1>
          <p className="text-sm text-text-secondary">
            Continue a verificação no app YaID Wallet aberto no seu celular.
          </p>
        </div>
      )}

      {status === "approved_by_user" && (
        <div role="status" aria-live="polite">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success-bg">
            <CheckCircle2 className="h-7 w-7 text-success-text" strokeWidth={2} />
          </div>
          <StatusBadge status="approved" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Validação concluída</h1>
          <p className="text-sm text-text-secondary">
            Sua validação foi processada com sucesso.
          </p>
          {returnUrl ? (
            <a
              href={returnUrl}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Voltar para {companyName ?? "a empresa"}
            </a>
          ) : null}
        </div>
      )}

      {status === "cancelled" && (
        <div role="status" aria-live="polite">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-bg">
            <XCircle className="h-7 w-7 text-error-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="rejected" label="Não concluído" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">
            Verificação não concluída
          </h1>
          <p className="text-sm text-text-secondary">
            Esta verificação não foi concluída. Volte para a plataforma parceira para tentar
            novamente.
          </p>
        </div>
      )}

      {status === "expired" && (
        <div role="status" aria-live="polite">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-bg">
            <Clock className="h-7 w-7 text-neutral-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="expired" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Link expirado</h1>
          <p className="text-sm text-text-secondary">
            Este link de verificação expirou. Solicite um novo link à empresa parceira.
          </p>
        </div>
      )}

      {status === "network" && (
        <div role="status" aria-live="polite">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-bg">
            <WifiOff className="h-7 w-7 text-neutral-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="pending" label="Sem conexão" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">
            Não foi possível conectar
          </h1>
          <p className="text-sm text-text-secondary">
            Verifique sua conexão. Vamos continuar tentando automaticamente.
          </p>
        </div>
      )}

      {status === "invalid" && (
        <div role="status" aria-live="polite">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-bg">
            <XCircle className="h-7 w-7 text-error-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="rejected" label="Inválida" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Link inválido</h1>
          <p className="text-sm text-text-secondary">
            Este link não corresponde a uma sessão de validação ativa.
          </p>
        </div>
      )}

      {!(KNOWN_STATUSES as string[]).includes(status) && (
        <div role="status" aria-live="polite">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-bg">
            <XCircle className="h-7 w-7 text-error-text" strokeWidth={1.8} />
          </div>
          <StatusBadge status="rejected" label="Inválida" size="md" />
          <h1 className="mb-2 mt-4 text-xl font-bold text-text-primary">Link inválido</h1>
          <p className="text-sm text-text-secondary">
            Este link não corresponde a uma sessão de validação ativa.
          </p>
        </div>
      )}
    </div>
  );
}
