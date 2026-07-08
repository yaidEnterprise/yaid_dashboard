/**
 * Story 2.2: Criação de App com API Key One-Shot
 *
 * Contract tests for backend creation flow, frontend form, and ApiKeyModal.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

describe("Story 2.2 — CreateCompanyAppSchema", () => {
  test("schema requires name", () => {
    const src = readText("src/modules/company-app/app/create_company_app_viewmodel.ts");
    assert.match(src, /name:\s*z\.string\(\)\.min\(1\)/, "name must be required with min(1)");
  });

  test("webhookUrl is optional", () => {
    const src = readText("src/modules/company-app/app/create_company_app_viewmodel.ts");
    assert.match(src, /webhookUrl.*\.optional\(\)/s, "webhookUrl must be optional");
  });

  test("environment defaults to dev when omitted", () => {
    const src = readText("src/modules/company-app/app/create_company_app_viewmodel.ts");
    assert.match(src, /environment.*\.optional\(\)\.default\("dev"\)/s, "environment must default to dev");
  });
});

describe("Story 2.2 — CreateCompanyAppUseCase", () => {
  // company_apps has no app_id column (confirmed against the live schema) — the
  // UUID `id` doubles as the public identifier used in the API key.
  test("generates UUID id and secret separately", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.match(src, /randomUUID/, "must generate id via randomUUID");
    assert.match(src, /generateSecret/, "must generate secret");
  });

  test("hashes full api key string id.secret", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.match(src, /const apiKey = `\$\{id\}\.\$\{secret\}`/, "apiKey must be id.secret format");
    assert.match(src, /hasher\.hash\(apiKey\)/, "must hash full apiKey string");
  });

  test("returns apiKey one-shot in response", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.match(src, /apiKey,/, "response must include apiKey");
    assert.match(src, /appId: app\.id/, "response must expose appId mirroring app.id");
  });

  test("does not persist a separate appId — CompanyApp constructor only receives id", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.equal(src.includes("generateAppId"), false, "must not generate a short app id anymore");
  });
});

describe("Story 2.2 — CompanyAppMapper", () => {
  // company_apps columns: id, company_id, name, api_key_hash, webhook_url,
  // environment, status, created_at — no app_id.
  test("CompanyAppPersistence has no app_id field", () => {
    const src = readText("src/shared/infra/dto/CompanyAppMapper.ts");
    assert.equal(src.includes("app_id"), false, "company_apps has no app_id column");
  });
});

describe("Story 2.2 — CompanyApp entity", () => {
  test("entity does not expose a separate appId getter", () => {
    const src = readText("src/shared/domain/entities/CompanyApp.ts");
    assert.equal(src.includes("appId"), false, "entity must not have a redundant appId field");
  });
});

describe("Story 2.2 — Create app page", () => {
  test("uses React Hook Form with zodResolver", () => {
    const src = readText("app/(dashboard)/apps/new/page.tsx");
    assert.match(src, /useForm/, "page must use useForm");
    assert.match(src, /zodResolver/, "page must use zodResolver");
  });

  test("has Identificação and Webhook cards only (no Ambiente card)", () => {
    const src = readText("app/(dashboard)/apps/new/page.tsx");
    assert.match(src, /Identificação/, "must have Identificação card");
    assert.match(src, /Webhook/, "must have Webhook card");
    assert.equal(src.includes("Ambiente"), false, "must not have Ambiente card");
  });

  test("uses ApiKeyModal component", () => {
    const src = readText("app/(dashboard)/apps/new/page.tsx");
    assert.match(src, /ApiKeyModal/, "page must use ApiKeyModal");
    assert.match(src, /router\.push\("\/apps"\)/, "must redirect to /apps on complete");
  });

  test("inline validation errors without API call on invalid name", () => {
    const src = readText("app/(dashboard)/apps/new/page.tsx");
    assert.match(src, /errors\.name/, "must show inline name errors");
    assert.match(src, /Informe o nome do app/, "must have name validation message");
  });
});

describe("Story 2.2 — ApiKeyModal", () => {
  test("blocks ESC from closing", () => {
    const src = readText("components/apps/api-key-modal.tsx");
    assert.match(src, /e\.key === "Escape"/, "must handle Escape key");
    assert.match(src, /e\.preventDefault\(\)/, "must prevent default on Escape");
  });

  test("blocks click outside from closing", () => {
    const src = readText("components/apps/api-key-modal.tsx");
    assert.match(src, /onMouseDown/, "must handle backdrop mouse down");
    assert.match(src, /e\.preventDefault\(\)/, "must prevent backdrop dismiss");
  });

  test("shows required checkbox and disabled Concluir button", () => {
    const src = readText("components/apps/api-key-modal.tsx");
    assert.match(src, /Confirmo que copiei minha API key/, "checkbox label must match AC");
    assert.match(src, /disabled=\{!confirmed\}/, "Concluir must be disabled until confirmed");
  });

  test("shows one-shot warning in amber alert", () => {
    const src = readText("components/apps/api-key-modal.tsx");
    assert.match(
      src,
      /Esta é a única vez que a API key será exibida/,
      "must show one-shot warning"
    );
  });

  test("uses CopyButton for api key", () => {
    const src = readText("components/apps/api-key-modal.tsx");
    assert.match(src, /CopyButton/, "must use CopyButton component");
  });
});

describe("Story 2.2 — apps-store", () => {
  test("CreateAppInput does not require environment", () => {
    const src = readText("utils/apps-store.ts");
    const inputSection = src.slice(src.indexOf("export type CreateAppInput"));
    assert.equal(inputSection.includes("environment:"), false, "CreateAppInput must not require environment");
    assert.match(inputSection, /webhookUrl\?:/, "webhookUrl must be optional");
  });

  test("YaidApp includes appId field", () => {
    const src = readText("utils/apps-store.ts");
    assert.match(src, /appId: string/, "YaidApp must include appId");
  });
});
