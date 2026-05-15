import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

test("Story 1.5 creates app/api/auth/sign-up/route.ts", () => {
  assertFileExists("app/api/auth/sign-up/route.ts");
});

test("Story 1.5 creates app/sign-up/layout.tsx", () => {
  assertFileExists("app/sign-up/layout.tsx");
});

test("Story 1.5 creates app/sign-up/page.tsx", () => {
  assertFileExists("app/sign-up/page.tsx");
});

// ─── Route handler: AC #1 — atomic signup ────────────────────────────────────

test("Story 1.5 route exports POST handler", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(src, /export async function POST/, "must export async POST");
});

test("Story 1.5 route defines Zod schema with required fields", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(src, /z\.string\(\)\.email\(\)/, "must validate email as email");
  assert.match(src, /z\.string\(\)\.min\(8\)/, "password must require min 8 chars");
  assert.match(src, /z\.string\(\)\.min\(1\)/, "name must require min 1 char");
});

test("Story 1.5 CNPJ schema uses .length(14) — rejects 11–13 digit strings (review patch)", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /\.length\(14\)/,
    "CNPJ must require exactly 14 digits — .min/.max would accept CPF-length inputs"
  );
  assert.equal(
    src.includes(".min(11)") || src.includes(".min(14)") && src.includes(".max(14)"),
    false,
    ".min(11) allows 11–13 digit strings which are not valid CNPJs — must use .length(14)"
  );
});

test("Story 1.5 route creates auth user with email_confirm: true", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /email_confirm:\s*true/,
    "must bypass email confirmation for MVP — no email verification flow"
  );
  assert.match(
    src,
    /admin\.auth\.admin\.createUser/,
    "must use admin client createUser — not signUp"
  );
});

test("Story 1.5 route guards authData.user before accessing .id (review patch)", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /if\s*\(!authData\.user\)/,
    "must guard authData.user null — Supabase types it as User | null"
  );
});

test("Story 1.5 route rolls back auth user when company creation fails", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /admin\.auth\.admin\.deleteUser\(userId\)/,
    "must call deleteUser(userId) to roll back orphaned auth user on company failure"
  );
});

test("Story 1.5 route logs rollback failures instead of swallowing them (review patch)", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /console\.error/,
    "must log rollback failure — silent swallow hides orphaned auth users"
  );
  assert.equal(
    src.includes(".catch(() => {})"),
    false,
    "empty catch block must not exist — errors must be logged"
  );
});

test("Story 1.5 route maps duplicate email to 409 with PT-BR message", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /already registered/,
    "must check Supabase 'already registered' message"
  );
  assert.match(
    src,
    /status:\s*409/,
    "must return HTTP 409 for duplicate email"
  );
  assert.match(
    src,
    /E-mail já cadastrado/,
    "must return PT-BR user-facing error message"
  );
});

test("Story 1.5 route returns { ok: true } with status 201 on success", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(src, /ok:\s*true/, "must include ok: true in success body");
  assert.match(src, /status:\s*201/, "must return HTTP 201 Created");
});

test("Story 1.5 route delegates unexpected errors to handleHttpError", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /handleHttpError/,
    "must use handleHttpError for consistent error shape across the API"
  );
});

test("Story 1.5 route uses CreateCompanyUseCase — reuse without reinvention", () => {
  const src = readText("app/api/auth/sign-up/route.ts");
  assert.match(
    src,
    /CreateCompanyUseCase/,
    "must reuse existing CreateCompanyUseCase — not reimplement company creation"
  );
});

// ─── Middleware: AC #3 — authenticated users redirected from /sign-up ────────

test("Story 1.5 middleware redirects authenticated users away from /sign-up", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /pathname === ["']\/sign-up["']/,
    "middleware must include /sign-up in authenticated user redirect condition"
  );
});

test("Story 1.5 middleware still redirects authenticated users from /sign-in", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /pathname === ["']\/sign-in["']/,
    "must still cover /sign-in — regression guard"
  );
});

test("Story 1.5 middleware classifies POST /api/auth/sign-up as public route (review patch)", () => {
  const src = readText("src/shared/middleware.ts");
  assert.match(
    src,
    /["']\/api\/auth\/sign-up["'].*POST|POST.*["']\/api\/auth\/sign-up["']/,
    "POST /api/auth/sign-up must be explicitly classified as public — without this it falls through unprotected"
  );
});

// ─── Layout: AC #2 — Toaster for toast feedback ──────────────────────────────

test("Story 1.5 sign-up layout includes Toaster from sonner", () => {
  const src = readText("app/sign-up/layout.tsx");
  assert.match(src, /from ["']sonner["']/, "must import from sonner");
  assert.match(src, /Toaster/, "must render Toaster component");
  assert.match(src, /richColors/, "must enable richColors for styled toasts");
  assert.match(
    src,
    /position=["']bottom-right["']/,
    "must position toasts at bottom-right — consistent with sign-in layout"
  );
});

// ─── Sign-up page: AC #2 — form validation and submit flow ───────────────────

test("Story 1.5 sign-up page is a client component", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /^["']use client["']/m,
    "page must be a Client Component — uses hooks and window.location"
  );
});

test("Story 1.5 sign-up page uses React Hook Form with zodResolver", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(src, /zodResolver/, "must use zodResolver for RHF + Zod integration");
  assert.match(src, /useForm/, "must use useForm from react-hook-form");
  assert.match(
    src,
    /mode:\s*["']onBlur["']/,
    "must use onBlur mode for field-level validation on blur"
  );
});

test("Story 1.5 sign-up page schema has confirmPassword refinement", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /confirmPassword/,
    "must have confirmPassword field"
  );
  assert.match(
    src,
    /\.refine\(/,
    "must use .refine() for cross-field password confirmation validation"
  );
  assert.match(
    src,
    /password === .*confirmPassword|confirmPassword.*=== .*password/,
    "refinement must compare password and confirmPassword fields"
  );
});

test("Story 1.5 sign-up page has CNPJ mask with 14-digit limit", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /formatCNPJ/,
    "must have formatCNPJ function for CNPJ display mask"
  );
  assert.match(
    src,
    /slice\(0,\s*14\)/,
    "CNPJ must truncate at 14 digits — Brazilian CNPJ is always exactly 14 digits"
  );
});

test("Story 1.5 sign-up page strips CNPJ mask before sending to API", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /replace\(\/\\D\/g,\s*["']["']\)/,
    "must strip non-digit characters before sending CNPJ to API"
  );
});

test("Story 1.5 sign-up page submits to POST /api/auth/sign-up", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /fetch\(["']\/api\/auth\/sign-up["']/,
    "must call /api/auth/sign-up — not fetchWithAuth (no session at signup time)"
  );
  assert.match(src, /method:\s*["']POST["']/, "must use POST method");
});

test("Story 1.5 sign-up page calls signInWithPassword after successful signup", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /signInWithPassword/,
    "must call signInWithPassword to establish session after account creation"
  );
});

test("Story 1.5 sign-up page redirects to / via window.location.href after sign-in", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /window\.location\.href\s*=\s*["']\/["']/,
    "must use window.location.href = '/' to force full reload for Supabase cookie revalidation"
  );
});

test("Story 1.5 sign-up page displays API errors via toast.error()", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(src, /toast\.error/, "must use toast.error() for API-level errors");
});

test("Story 1.5 sign-up page button is disabled during isSubmitting", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /disabled=\{isSubmitting\}/,
    "submit button must be disabled during submission to prevent double-submit"
  );
});

test("Story 1.5 sign-up page has link to /sign-in", () => {
  const src = readText("app/sign-up/page.tsx");
  assert.match(
    src,
    /href=["']\/sign-in["']/,
    "must link back to /sign-in for existing users"
  );
});

// ─── Sign-in page: link updated to /sign-up ──────────────────────────────────

test("Story 1.5 sign-in page links to /sign-up for new company registration", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.match(
    src,
    /href=["']\/sign-up["']/,
    "sign-in must link to /sign-up — not /onboarding/company which was removed in Story 1.1"
  );
});

test("Story 1.5 sign-in page no longer links to /onboarding/company", () => {
  const src = readText("app/sign-in/page.tsx");
  assert.equal(
    src.includes("/onboarding/company"),
    false,
    "/onboarding/company was removed in Story 1.1 — link must not reference it"
  );
});

// ─── Inline behavioral tests ─────────────────────────────────────────────────

// CNPJ formatting logic — replicated inline to test independently of React

test("Story 1.5 CNPJ formatter produces correct masked output for full 14-digit input", () => {
  function formatCNPJ(value) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  assert.equal(formatCNPJ("11222333000181"), "11.222.333/0001-81", "full CNPJ must be formatted correctly");
  assert.equal(formatCNPJ("11.222.333/0001-81"), "11.222.333/0001-81", "already-masked input must produce same output");
  assert.equal(formatCNPJ(""), "", "empty string must produce empty string");
  assert.equal(formatCNPJ("11"), "11", "partial input must not add separator");
  assert.equal(formatCNPJ("112"), "11.2", "3-digit partial gets first dot");
  assert.equal(formatCNPJ("112223330001819999"), "11.222.333/0001-81", "input beyond 14 digits must be truncated");
});

test("Story 1.5 CNPJ formatter strips non-digit characters", () => {
  function formatCNPJ(value) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  assert.equal(formatCNPJ("11.222.333/0001"), "11.222.333/0001", "partial with punctuation handled");
  assert.equal(formatCNPJ("abc11222333000181xyz"), "11.222.333/0001-81", "non-digit chars stripped before processing");
});

// Zod confirmPassword refinement — replicated inline

test("Story 1.5 confirmPassword refinement rejects mismatched passwords", async () => {
  const { z } = await import("zod");

  const schema = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string(),
      companyName: z.string().min(1).max(50),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "As senhas não coincidem",
      path: ["confirmPassword"],
    });

  const valid = schema.safeParse({
    email: "a@b.com",
    password: "secret123",
    confirmPassword: "secret123",
    companyName: "Acme",
  });
  assert.equal(valid.success, true, "matching passwords must pass validation");

  const invalid = schema.safeParse({
    email: "a@b.com",
    password: "secret123",
    confirmPassword: "different",
    companyName: "Acme",
  });
  assert.equal(invalid.success, false, "mismatched passwords must fail validation");
  assert.equal(
    invalid.error.issues[0]?.path[0],
    "confirmPassword",
    "error must target confirmPassword field"
  );
});

// CNPJ length validation — inline Zod schema

test("Story 1.5 API SignUpSchema rejects CNPJ shorter than 14 digits (review patch)", async () => {
  const { z } = await import("zod");

  const SignUpSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(50),
    cnpj: z.string().length(14).regex(/^\d+$/).optional().nullable(),
  });

  const withValid = SignUpSchema.safeParse({
    email: "a@b.com",
    password: "secret123",
    name: "Acme",
    cnpj: "11222333000181",
  });
  assert.equal(withValid.success, true, "14-digit CNPJ must be accepted");

  const withShort = SignUpSchema.safeParse({
    email: "a@b.com",
    password: "secret123",
    name: "Acme",
    cnpj: "1122233300018",
  });
  assert.equal(withShort.success, false, "13-digit CNPJ must be rejected");

  const withoutCnpj = SignUpSchema.safeParse({
    email: "a@b.com",
    password: "secret123",
    name: "Acme",
    cnpj: null,
  });
  assert.equal(withoutCnpj.success, true, "null CNPJ must be accepted (optional)");

  const withMasked = SignUpSchema.safeParse({
    email: "a@b.com",
    password: "secret123",
    name: "Acme",
    cnpj: "11.222.333/0001-81",
  });
  assert.equal(withMasked.success, false, "masked CNPJ must be rejected — API expects raw digits only");
});

// ─── TypeScript compilation ───────────────────────────────────────────────────

test("Story 1.5 all new files compile without TypeScript errors", { timeout: 120_000 }, () => {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["tsc", "--noEmit"], {
    cwd: projectRoot,
    env: { ...process.env, STAGE: "TEST" },
    stdio: "pipe",
    shell: process.platform === "win32",
  });
});
