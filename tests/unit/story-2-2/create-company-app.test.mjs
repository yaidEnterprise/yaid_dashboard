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
  test("generates appId and secret separately", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.match(src, /generateAppId/, "must generate public appId");
    assert.match(src, /generateSecret/, "must generate secret");
  });

  test("hashes full api key string appId.secret", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.match(src, /const apiKey = `\$\{appId\}\.\$\{secret\}`/, "apiKey must be appId.secret format");
    assert.match(src, /hasher\.hash\(apiKey\)/, "must hash full apiKey string");
  });

  test("returns apiKey one-shot in response", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.match(src, /apiKey,/, "response must include apiKey");
    assert.match(src, /appId: app\.appId/, "response must include public appId");
  });

  test("persists app_id via CompanyApp entity", () => {
    const src = readText("src/modules/company-app/app/create_company_app_usecase.ts");
    assert.match(src, /appId,/, "CompanyApp constructor must receive appId");
  });
});

describe("Story 2.2 — CompanyAppMapper", () => {
  test("maps app_id in toDomain and toPersistence", () => {
    const src = readText("src/shared/infra/dto/CompanyAppMapper.ts");
    assert.match(src, /appId: raw\.app_id/, "toDomain must map app_id");
    assert.match(src, /app_id: app\.appId/, "toPersistence must map app_id");
  });
});

describe("Story 2.2 — CompanyApp entity", () => {
  test("entity exposes appId getter", () => {
    const src = readText("src/shared/domain/entities/CompanyApp.ts");
    assert.match(src, /get appId\(\)/, "entity must expose appId getter");
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
