import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), "utf8");
const assertFileExists = (rel) =>
  assert.ok(existsSync(fromRoot(rel)), `${rel} should exist`);

// ─── File contracts ──────────────────────────────────────────────────────────

test("Story 1.6 app/sign-in/page.tsx exists", () => {
  assertFileExists("app/sign-in/page.tsx");
});

test("Story 1.6 app/sign-in/layout.tsx exists with Toaster", () => {
  assertFileExists("app/sign-in/layout.tsx");
  const src = readText("app/sign-in/layout.tsx");
  assert.match(src, /Toaster/, "layout must render Toaster for toast feedback");
  assert.match(src, /from ["']sonner["']/, "must import Toaster from sonner");
});

// ─── Sign-in page: AC #2 — React Hook Form + Zod ────────────────────────────

test("Story 1.6 sign-in page is a client component", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /^["']use client["']/m,
    "page must be a Client Component — uses hooks and browser APIs"
  );
});

test("Story 1.6 sign-in page uses React Hook Form with zodResolver", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(src, /zodResolver/, "must use zodResolver for RHF + Zod integration");
  assert.match(src, /useForm/, "must use useForm from react-hook-form");
});

test("Story 1.6 sign-in page defines Zod schema with email and password fields", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(src, /z\.string\(\)\.email/, "must validate email format");
  assert.match(src, /password/, "must have password field in schema");
});

test("Story 1.6 signInSchema has no field-specific error messages (review patch)", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.equal(
    src.includes('"E-mail inválido"') || src.includes("'E-mail inválido'"),
    false,
    "schema must not carry field-specific messages — violates generic error principle"
  );
  assert.equal(
    src.includes('"Senha é obrigatória"') || src.includes("'Senha é obrigatória'"),
    false,
    "schema must not carry field-specific messages — violates generic error principle"
  );
});

test("Story 1.6 sign-in page has onValidationError handler for silent Zod failures (review patch)", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /handleSubmit\(onSubmit,\s*on/,
    "handleSubmit must have a second error handler to give feedback when Zod validation fails silently"
  );
  assert.match(
    src,
    /toast\.error.*Preencha/,
    "validation error toast must inform user to fill in fields"
  );
});

test("Story 1.6 sign-in page uses isSubmitting from RHF formState (not useState loading)", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /isSubmitting/,
    "must use isSubmitting from RHF formState for button disabled state"
  );
});

test("Story 1.6 sign-in button is disabled during isSubmitting", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /disabled=\{isSubmitting\}/,
    "submit button must be disabled during submission to prevent double-submit"
  );
});

// ─── Sign-in page: AC #2 — toast error (not inline AlertCircle) ─────────────

test("Story 1.6 sign-in page uses toast.error() for auth errors", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /toast\.error/,
    "must use toast.error() for authentication failures — generic message without exposing email/password detail"
  );
});

test("Story 1.6 sign-in page imports toast from sonner", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /from ["']sonner["']/,
    "must import toast from sonner"
  );
});

test("Story 1.6 sign-in page does NOT render inline AlertCircle error div", () => {
  const src = readText("app/sign-in/page.tsx");
  // The old pattern was: {error && (<div className="flex items-center gap-2 rounded-lg border border-error-border
  // Now errors go through toast — no inline error state block
  assert.equal(
    src.includes("border-error-border"),
    false,
    "must not use inline AlertCircle error div — errors are now shown via toast.error()"
  );
  assert.equal(
    src.includes("error-bg"),
    false,
    "must not have error-bg class — inline error styling replaced by toast"
  );
});

test("Story 1.6 sign-in page does not use useState for error state", () => {
  const src = readText("app/sign-in/page.tsx");
  // The old page used: const [error, setError] = useState("")
  // With RHF + toast, there's no separate error state
  assert.equal(
    src.includes('useState("")'),
    false,
    "must not use useState('') for error state — errors handled by toast.error()"
  );
  assert.equal(
    src.includes("setError"),
    false,
    "must not have setError — error state replaced by toast.error()"
  );
});

// ─── Sign-in page: AC #1 — redirect after login ──────────────────────────────

test("Story 1.6 sign-in page reads ?next= param and validates it before redirect", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /next/,
    "must handle ?next= parameter for post-login redirect"
  );
  assert.match(
    src,
    /startsWith\(["']\/["']\)/,
    "must validate next param starts with / to prevent open redirect"
  );
  assert.match(
    src,
    /startsWith\(["']\/\/["']\)/,
    "must reject // prefixes to prevent protocol-relative URL redirect"
  );
});

test("Story 1.6 sign-in page redirects to the validated path after login", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /router\.push\(safePath\)/,
    "must redirect to the validated safe path after login (router.push(safePath))"
  );
});

test("Story 1.6 sign-in page calls supabase.auth.signInWithPassword", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /signInWithPassword/,
    "must call Supabase signInWithPassword for authentication"
  );
});

// ─── Sign-in page: AC #1 — maintains sign-up link ────────────────────────────

test("Story 1.6 sign-in page still has link to /sign-up", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /href=["']\/sign-up["']/,
    "must link to /sign-up for new company registration"
  );
});

// ─── Middleware: AC #3 — unauthenticated users redirected from dashboard ──────

test("Story 1.6 middleware isDashboardPage covers /dashboard (overview)", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /["']\/dashboard["']/,
    "isDashboardPage must include /dashboard — Story 13.1 moved the overview off the root path"
  );
});

test("Story 1.6 middleware isDashboardPage covers /apps", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /["']\/apps["']/,
    "isDashboardPage must include /apps"
  );
});

test("Story 1.6 middleware isDashboardPage covers /proof-requests", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /["']\/proof-requests["']/,
    "isDashboardPage must include /proof-requests"
  );
});

test("Story 1.6 middleware isDashboardPage covers /settings", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /["']\/settings["']/,
    "isDashboardPage must include /settings"
  );
});

test("Story 1.6 middleware redirects unauthenticated users to /sign-in with ?next=", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /redirectOnFail:\s*["']\/sign-in["']/,
    "withSessionAuth must be called with redirectOnFail: '/sign-in' for dashboard pages"
  );
});

// ─── Middleware: AC #4 — authenticated users redirected away from /sign-in ───

test("Story 1.6 middleware redirects authenticated users from /sign-in to /dashboard", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /pathname === ["']\/sign-in["']/,
    "middleware must redirect authenticated users away from /sign-in"
  );
  assert.match(
    src,
    /NextResponse\.redirect\(new URL\(["']\/dashboard["']/,
    "redirect target must be /dashboard — Story 13.1 moved the overview off the root path"
  );
});

// ─── withSessionAuth: ?next= injection ───────────────────────────────────────

test("Story 1.6 withSessionAuth injects ?next= param in redirect URL", () => {
  const src = readText("src/shared/middlewares/withSessionAuth.ts");
  assert.match(
    src,
    /searchParams\.set\(["']next["']/,
    "withSessionAuth must set ?next= param so users return to intended page after login"
  );
});

// ─── Behavioral tests: signInSchema validation ────────────────────────────────

test("Story 1.6 signInSchema rejects invalid email format", async () => {
  const { z } = await import("zod");

  const signInSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(1, "Senha é obrigatória"),
  });

  const invalid = signInSchema.safeParse({ email: "not-an-email", password: "pass" });
  assert.equal(invalid.success, false, "invalid email must fail schema validation");

  const valid = signInSchema.safeParse({ email: "user@example.com", password: "pass" });
  assert.equal(valid.success, true, "valid email + password must pass");
});

test("Story 1.6 signInSchema rejects empty password", async () => {
  const { z } = await import("zod");

  const signInSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(1, "Senha é obrigatória"),
  });

  const invalid = signInSchema.safeParse({ email: "user@example.com", password: "" });
  assert.equal(invalid.success, false, "empty password must fail validation");

  const withPassword = signInSchema.safeParse({ email: "user@example.com", password: "x" });
  assert.equal(withPassword.success, true, "any non-empty password must pass schema validation");
});

test("Story 1.6 safe redirect logic rejects protocol-relative URLs", () => {
  // Inline replication of the safe redirect logic from sign-in page
  function getSafePath(next) {
    return next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/dashboard";
  }

  assert.equal(getSafePath(null), "/dashboard", "null next → /dashboard");
  assert.equal(getSafePath(undefined), "/dashboard", "undefined next → /dashboard");
  assert.equal(getSafePath(""), "/dashboard", "empty next → /dashboard");
  assert.equal(getSafePath("/apps"), "/apps", "valid path /apps → /apps");
  assert.equal(getSafePath("/proof-requests/123"), "/proof-requests/123", "deep path preserved");
  assert.equal(
    getSafePath("//evil.com"),
    "/dashboard",
    "protocol-relative URL rejected → /dashboard"
  );
  assert.equal(
    getSafePath("http://evil.com"),
    "/dashboard",
    "absolute URL rejected → /dashboard"
  );
  assert.equal(
    getSafePath("javascript:alert(1)"),
    "/dashboard",
    "XSS payload rejected → /dashboard"
  );
});

// ─── TypeScript compilation ───────────────────────────────────────────────────

test("Story 1.6 all changed files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
  execSync(`"${tscBin}" --noEmit`, {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: true,
  });
});
