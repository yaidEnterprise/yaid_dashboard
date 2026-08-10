"use client";

import { useEffect, useState } from "react";

export type ProofSessionStatusResponse = {
  status: "waiting_user" | "opened" | "approved_by_user" | "expired" | "cancelled";
  proofType: string;
  companyName: string;
  expiresAt: string;
  returnUrl?: string | null;
};

const POLL_INTERVAL_MS = 7000;
const FETCH_TIMEOUT_MS = 10000;
const TERMINAL_STATUSES = new Set(["approved_by_user", "expired", "cancelled"]);
const ACTIVE_STATUSES = new Set(["waiting_user", "opened"]);

export function getSecondsRemaining(expiresAt: string): number {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

type PollingState = {
  session: ProofSessionStatusResponse | null;
  loading: boolean;
  error: "invalid" | "network" | null;
  secondsRemaining: number;
};

export function useProofSessionPolling(sessionToken: string): PollingState {
  const [session, setSession] = useState<ProofSessionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"invalid" | "network" | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    async function fetchStatus() {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(`/api/proof-sessions/${sessionToken}`, {
          cache: "no-store",
          signal: timeoutController.signal,
        });
        if (cancelled) return;

        if (res.status === 404) {
          setError("invalid");
          setSession(null);
          stopPolling();
          return;
        }
        if (!res.ok) {
          setError("network");
          return;
        }

        const data = (await res.json()) as ProofSessionStatusResponse;
        if (cancelled) return;

        setSession(data);
        setError(null);
        setSecondsRemaining(getSecondsRemaining(data.expiresAt));

        if (TERMINAL_STATUSES.has(data.status)) {
          stopPolling();
        }
      } catch {
        if (!cancelled) setError("network");
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    pollTimer = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [sessionToken]);

  // Independent 1s countdown so the display doesn't wait for the next poll tick.
  const isActive = session ? ACTIVE_STATUSES.has(session.status) : false;
  useEffect(() => {
    if (!isActive) return;
    const tickTimer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(tickTimer);
  }, [isActive]);

  return { session, loading, error, secondsRemaining };
}
