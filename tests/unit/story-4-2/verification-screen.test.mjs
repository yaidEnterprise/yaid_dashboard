/**
 * Story 4.2: Tela Coringa com Polling e 6 Estados Visuais
 *
 * Tests cover:
 * - AC #1: waiting_user layout (independent, no sidebar/topbar), company/proofType, deep link, countdown, polling start
 * - AC #2: opened state hides deep link, keeps polling
 * - AC #3: approved_by_user shows success + conditional returnUrl button, stops polling
 * - AC #4: cancelled shows generic non-completion message, stops polling
 * - AC #5: expired shows clear message, stops polling, client-side countdown-to-zero forces expired
 * - AC #6: invalid/unknown token shows generic message (no enumeration)
 * - AC #7: no sensitive fields ever rendered
 * - Polling cadence within 5-10s, no fetchWithAuth (public route), aria-live for state changes
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const PAGE = "app/v/[sessionToken]/page.tsx";
const HOOK = "app/v/[sessionToken]/use-proof-session-polling.ts";
const LAYOUT = "components/verification/verification-layout.tsx";
const STATE_CARD = "components/verification/verification-state-card.tsx";
const DEEP_LINK_BUTTON = "components/verification/deep-link-button.tsx";

describe("Story 4.2 — useProofSessionPolling hook", () => {
  test("fetches via public GET /api/proof-sessions/{token}, not fetchWithAuth", () => {
    const src = readText(HOOK);
    assert.match(src, /\/api\/proof-sessions\/\$\{sessionToken\}/, "must fetch the public status endpoint");
    assert.equal(src.includes("fetchWithAuth"), false, "public route must not use fetchWithAuth");
  });

  test("polling interval is within the 5-10s range required by AC #1/FR14", () => {
    const src = readText(HOOK);
    const match = src.match(/POLL_INTERVAL_MS\s*=\s*(\d+)/);
    assert.ok(match, "must define POLL_INTERVAL_MS");
    const ms = Number(match[1]);
    assert.ok(ms >= 5000 && ms <= 10000, `POLL_INTERVAL_MS (${ms}) must be between 5000 and 10000`);
  });

  test("stops polling on terminal statuses (AC #3, #4, #5)", () => {
    const src = readText(HOOK);
    assert.match(src, /TERMINAL_STATUSES/, "must define terminal statuses");
    assert.match(src, /approved_by_user/);
    assert.match(src, /expired/);
    assert.match(src, /cancelled/);
    assert.match(src, /clearInterval/, "must clear the polling interval on terminal status");
  });

  test("clears interval on unmount (no leaked timers)", () => {
    const src = readText(HOOK);
    assert.match(src, /return\s*\(\s*\)\s*=>\s*\{[\s\S]*clearInterval/, "effect cleanup must clear timers");
  });

  test("treats 404 as invalid session, not generic network error", () => {
    const src = readText(HOOK);
    assert.match(src, /404/);
    assert.match(src, /"invalid"/);
  });

  test("exports getSecondsRemaining derived from expiresAt", () => {
    const src = readText(HOOK);
    assert.match(src, /export function getSecondsRemaining/);
    assert.match(src, /expiresAt/);
  });

  test("DTO type does not include internal fields (id, proofRequestId, createdAt, openedAt, approvedAt)", () => {
    const src = readText(HOOK);
    for (const forbidden of ["proofRequestId", "openedAt", "approvedAt", "  id:", "createdAt"]) {
      assert.equal(src.includes(forbidden), false, `hook DTO type must not include ${forbidden}`);
    }
  });

  test("returnUrl is typed as optional (backend may omit it)", () => {
    const src = readText(HOOK);
    assert.match(src, /returnUrl\?:/, "returnUrl must be optional in the response type");
  });

  test("getSecondsRemaining guards against a malformed/NaN expiresAt (review patch)", () => {
    const src = readText(HOOK);
    assert.match(src, /Number\.isNaN/, "must guard against NaN dates so the countdown doesn't get stuck at NaN:NaN");
  });

  test("fetch has a timeout via AbortController so a hung request can't strand the loading spinner (review patch)", () => {
    const src = readText(HOOK);
    assert.match(src, /AbortController/);
    assert.match(src, /signal:\s*timeoutController\.signal/);
  });
});

describe("Story 4.2 — VerificationLayout component", () => {
  test("is an independent full-screen layout (no dashboard chrome)", () => {
    const src = readText(LAYOUT);
    assert.match(src, /min-h-screen/);
    for (const forbidden of ["AppSidebar", "Topbar", "sidebar", "topbar"]) {
      assert.equal(src.includes(forbidden), false, `verification layout must not include ${forbidden}`);
    }
  });

  test("uses semantic design tokens, not literal UX-spec gray/blue classes", () => {
    const src = readText(LAYOUT);
    assert.equal(src.includes("bg-gray-50"), false, "must use bg-background token, not literal gray-50");
    assert.equal(src.includes("blue-600"), false, "must use semantic tokens, not literal blue-600");
  });
});

describe("Story 4.2 — DeepLinkButton component", () => {
  test("builds deep link from sessionToken param", () => {
    const src = readText(DEEP_LINK_BUTTON);
    assert.match(src, /yaid:\/\/verify\?session=/);
  });

  test("meets 48px minimum touch target", () => {
    const src = readText(DEEP_LINK_BUTTON);
    assert.match(src, /min-h-\[48px\]/);
  });

  test("URI-encodes sessionToken before building the deep link (review patch)", () => {
    const src = readText(DEEP_LINK_BUTTON);
    assert.match(src, /encodeURIComponent\(sessionToken\)/);
  });
});

describe("Story 4.2 — VerificationStateCard component (6 visual states)", () => {
  test("handles all 6 states: waiting_user, opened, approved_by_user, cancelled, expired, invalid", () => {
    const src = readText(STATE_CARD);
    for (const state of ["waiting_user", "opened", "approved_by_user", "cancelled", "expired", "invalid"]) {
      assert.match(src, new RegExp(`status === "${state}"`), `must render a distinct branch for ${state}`);
    }
  });

  test("has aria-live region for screen reader announcements on state change", () => {
    const src = readText(STATE_CARD);
    assert.match(src, /aria-live="polite"/);
  });

  test("reuses formatProofType instead of a new translation map", () => {
    const src = readText(STATE_CARD);
    assert.match(src, /formatProofType/);
    assert.match(src, /@\/utils\/proof-requests-store/);
  });

  test("opened state does not render the deep link button (AC #2)", () => {
    const src = readText(STATE_CARD);
    const start = src.indexOf('status === "opened"');
    const end = src.indexOf('status === "approved_by_user"');
    assert.ok(start !== -1 && end !== -1 && end > start, "must find the opened-state JSX block");
    const openedBlock = src.slice(start, end);
    assert.equal(openedBlock.includes("DeepLinkButton"), false, "opened state must not render DeepLinkButton");
  });

  test("approved_by_user return-to-company button is conditional on returnUrl (AC #3)", () => {
    const src = readText(STATE_CARD);
    assert.match(src, /returnUrl \? \(/, "return button must be conditionally rendered");
  });

  test("cancelled and expired render distinct messages (not reused copy)", () => {
    const src = readText(STATE_CARD);
    const cancelledMatch = src.match(/status === "cancelled" && \(([\s\S]*?)status === "expired"/);
    assert.ok(cancelledMatch);
    assert.equal(
      cancelledMatch[1].includes("Este link de verificação expirou"),
      false,
      "cancelled state must not reuse the expired copy"
    );
  });

  test("invalid state message does not distinguish reason (no enumeration, AC #6)", () => {
    const src = readText(STATE_CARD);
    const invalidBlockMatch = src.match(/status === "invalid" && \(([\s\S]*)$/);
    assert.ok(invalidBlockMatch);
    for (const forbidden of ["não existe", "pertence a outra", "not found for"]) {
      assert.equal(invalidBlockMatch[1].toLowerCase().includes(forbidden.toLowerCase()), false);
    }
  });

  test("never renders sensitive fields (AC #7)", () => {
    const src = readText(STATE_CARD);
    for (const forbidden of ["externalReference", "requestId", "challengeNonceHash"]) {
      assert.equal(src.includes(forbidden), false, `must not render ${forbidden}`);
    }
  });

  test("waiting_user and opened states use StatusBadge per the Dev Notes mapping table (review patch)", () => {
    const src = readText(STATE_CARD);
    const waitingStart = src.indexOf('status === "waiting_user"');
    const waitingEnd = src.indexOf('status === "opened"');
    const openedEnd = src.indexOf('status === "approved_by_user"');
    const waitingBlock = src.slice(waitingStart, waitingEnd);
    const openedBlock = src.slice(waitingEnd, openedEnd);
    assert.match(waitingBlock, /StatusBadge status="pending"/, "waiting_user must render a pending StatusBadge");
    assert.match(openedBlock, /StatusBadge status="processing"/, "opened must render a processing StatusBadge");
  });

  test("countdown is excluded from the aria-live region so it isn't re-announced every second (review patch)", () => {
    const src = readText(STATE_CARD);
    const waitingStart = src.indexOf('status === "waiting_user"');
    const waitingEnd = src.indexOf('status === "opened"');
    const waitingBlock = src.slice(waitingStart, waitingEnd);
    const liveRegionMatch = waitingBlock.match(/role="status" aria-live="polite">([\s\S]*?)<\/div>/);
    assert.ok(liveRegionMatch, "must find the waiting_user live region");
    assert.equal(
      liveRegionMatch[1].includes("formatCountdown"),
      false,
      "the per-second countdown must live outside the aria-live region"
    );
  });

  test("has a fallback branch for unrecognized status values (review patch)", () => {
    const src = readText(STATE_CARD);
    assert.match(src, /!\(KNOWN_STATUSES as string\[\]\)\.includes\(status\)/, "must guard against unknown status values at runtime");
  });

  test("has a distinct network-error state, separate from invalid (review patch)", () => {
    const src = readText(STATE_CARD);
    assert.match(src, /status === "network"/);
  });
});

describe("Story 4.2 — app/v/[sessionToken]/page.tsx", () => {
  test("does not use the stale local ProofSession DTO shape from before Story 4.1", () => {
    const src = readText(PAGE);
    for (const forbidden of ["proofRequestId", "openedAt", "approvedAt"]) {
      assert.equal(src.includes(forbidden), false, `page must not reference pre-4.1 field ${forbidden}`);
    }
  });

  test("does not render a QR code placeholder (out of MVP scope per FR14)", () => {
    const src = readText(PAGE);
    assert.equal(src.includes("QrCode"), false, "QR code is out of scope for the MVP");
  });

  test("uses the polling hook instead of a one-shot fetch", () => {
    const src = readText(PAGE);
    assert.match(src, /useProofSessionPolling/);
  });

  test("forces expired display when the client-side countdown reaches zero (AC #5)", () => {
    const src = readText(PAGE);
    assert.match(src, /secondsRemaining\s*<=\s*0/);
  });

  test("renders VerificationLayout and VerificationStateCard", () => {
    const src = readText(PAGE);
    assert.match(src, /VerificationLayout/);
    assert.match(src, /VerificationStateCard/);
  });

  test("the 'opened' display is driven only by session.status, not a local click flag (review patch, AC #2)", () => {
    const src = readText(PAGE);
    assert.equal(src.includes("clickedOpen"), false, "opened must be server-confirmed, not client-optimistic");
    assert.equal(src.includes("useState"), false, "page no longer needs local click state");
  });

  test("distinguishes a network error from an invalid/unknown token on first load (review patch, AC #6)", () => {
    const src = readText(PAGE);
    assert.match(src, /error === "network" \? "network" : "invalid"/);
  });
});
