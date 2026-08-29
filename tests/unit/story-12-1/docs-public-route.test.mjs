import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

describe("Story 12.1 — contrato público", () => {
  test("/docs não pertence ao grupo autenticado nem precisa de API", () => {
    const middleware = read("src/shared/middleware.ts");
    const dashboardClassifier = middleware.slice(
      middleware.indexOf("function isDashboardPage"),
      middleware.indexOf("function isPublicAuthPage"),
    );
    assert.doesNotMatch(dashboardClassifier, /["']\/docs["']/);
    assert.doesNotMatch(read("app/docs/page.tsx"), /fetch\(|getSupabase|useSession|process\.env/);
  });

  test("a QA da Story 7.6 protege o detalhe, não proíbe consumidores futuros", () => {
    const oldQa = read("tests/unit/story-7-6/qa-regression.test.mjs");
    assert.doesNotMatch(oldQa, /CodeBlock has zero consumers|no source file .* imports CodeBlock/);
    assert.match(oldQa, /Resposta da API|<CodeBlock/);
  });

  test("o deferred de CodeBlock está marcado como resolvido pela Story 12.1", () => {
    const debt = read("_bmad-output/implementation-artifacts/deferred-work.md");
    assert.match(debt, /CodeBlock[^\n]*RESOLVIDO[^\n]*Story 12\.1/i);
  });
});
