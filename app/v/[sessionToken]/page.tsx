"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { VerificationLayout } from "@/components/verification/verification-layout";
import {
  VerificationStateCard,
  type VerificationDisplayStatus,
} from "@/components/verification/verification-state-card";
import { useProofSessionPolling } from "./use-proof-session-polling";

export default function VerificationPage() {
  const params = useParams();
  const sessionToken = params.sessionToken as string;

  const { session, loading, error, secondsRemaining } = useProofSessionPolling(sessionToken);

  if (loading) {
    return (
      <VerificationLayout>
        <div className="flex items-center justify-center py-8" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-trust" />
        </div>
      </VerificationLayout>
    );
  }

  if (!session) {
    // 404 (invalid/unknown token) and transient network failures on first
    // load are distinct: a network hiccup should not read as "this link is
    // permanently broken" while polling keeps retrying in the background.
    return (
      <VerificationLayout>
        <VerificationStateCard
          status={error === "network" ? "network" : "invalid"}
          sessionToken={sessionToken}
        />
      </VerificationLayout>
    );
  }

  const isActive = session.status === "waiting_user" || session.status === "opened";
  const clockExpired = isActive && secondsRemaining <= 0;

  // displayStatus always mirrors the server-confirmed session.status — the
  // only client-side override is the countdown reaching zero (AC #5), which
  // forces "expired" ahead of the next poll confirming it.
  const displayStatus: VerificationDisplayStatus = clockExpired ? "expired" : session.status;

  return (
    <VerificationLayout>
      <VerificationStateCard
        status={displayStatus}
        sessionToken={sessionToken}
        companyName={session.companyName}
        proofType={session.proofType}
        secondsRemaining={secondsRemaining}
        returnUrl={session.returnUrl}
      />
    </VerificationLayout>
  );
}
