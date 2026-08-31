import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

const fromRoot = (...segments) => path.join(projectRoot, ...segments);

function readText(...segments) {
  return readFileSync(fromRoot(...segments), "utf8");
}

function assertFileExists(relativePath) {
  assert.ok(existsSync(fromRoot(relativePath)), `${relativePath} should exist`);
}

function assertPathMissing(relativePath) {
  assert.equal(
    existsSync(fromRoot(relativePath)),
    false,
    `${relativePath} should have been removed`,
  );
}

function walkFiles(relativeDir) {
  const root = fromRoot(relativeDir);
  const files = [];

  function walk(current) {
    for (const entry of readdirSync(current)) {
      const absolutePath = path.join(current, entry);
      const stat = statSync(absolutePath);

      if (stat.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      files.push(path.relative(projectRoot, absolutePath));
    }
  }

  walk(root);
  return files;
}

test("Story 1.1 configures src path aliases before the root fallback", () => {
  const tsconfig = JSON.parse(readText("tsconfig.json"));
  const paths = tsconfig.compilerOptions.paths;
  const aliasOrder = Object.keys(paths);

  assert.deepEqual(paths["@/modules/*"], ["./src/modules/*"]);
  assert.deepEqual(paths["@/shared/*"], ["./src/shared/*"]);
  assert.deepEqual(paths["@/*"], ["./*"]);
  assert.ok(aliasOrder.indexOf("@/modules/*") < aliasOrder.indexOf("@/*"));
  assert.ok(aliasOrder.indexOf("@/shared/*") < aliasOrder.indexOf("@/*"));
});

test("Story 1.1 exposes migrated module files with the agreed convention", () => {
  const expectedModuleFiles = [
    "src/modules/company/app/create_company_controller.ts",
    "src/modules/company/app/create_company_presenter.ts",
    "src/modules/company/app/create_company_usecase.ts",
    "src/modules/company/app/create_company_viewmodel.ts",
    "src/modules/company/app/get_my_company_controller.ts",
    "src/modules/company/app/get_my_company_presenter.ts",
    "src/modules/company/app/get_my_company_usecase.ts",
    "src/modules/company/app/get_my_company_viewmodel.ts",
    "src/modules/company-app/app/create_company_app_controller.ts",
    "src/modules/company-app/app/create_company_app_presenter.ts",
    "src/modules/company-app/app/create_company_app_usecase.ts",
    "src/modules/company-app/app/create_company_app_viewmodel.ts",
    "src/modules/company-app/app/get_company_app_controller.ts",
    "src/modules/company-app/app/get_company_app_presenter.ts",
    "src/modules/company-app/app/get_company_app_usecase.ts",
    "src/modules/company-app/app/get_company_app_viewmodel.ts",
    "src/modules/company-app/app/list_company_apps_controller.ts",
    "src/modules/company-app/app/list_company_apps_presenter.ts",
    "src/modules/company-app/app/list_company_apps_usecase.ts",
    "src/modules/company-app/app/list_company_apps_viewmodel.ts",
    "src/modules/company-app/app/update_company_app_controller.ts",
    "src/modules/company-app/app/update_company_app_presenter.ts",
    "src/modules/company-app/app/update_company_app_usecase.ts",
    "src/modules/company-app/app/update_company_app_viewmodel.ts",
    "src/modules/proof-request/app/create_proof_request_controller.ts",
    "src/modules/proof-request/app/create_proof_request_presenter.ts",
    "src/modules/proof-request/app/create_proof_request_usecase.ts",
    "src/modules/proof-request/app/create_proof_request_viewmodel.ts",
    "src/modules/proof-request/app/get_proof_request_controller.ts",
    "src/modules/proof-request/app/get_proof_request_presenter.ts",
    "src/modules/proof-request/app/get_proof_request_usecase.ts",
    "src/modules/proof-request/app/get_proof_request_viewmodel.ts",
    "src/modules/proof-request/app/list_proof_requests_controller.ts",
    "src/modules/proof-request/app/list_proof_requests_presenter.ts",
    "src/modules/proof-request/app/list_proof_requests_usecase.ts",
    "src/modules/proof-request/app/list_proof_requests_viewmodel.ts",
    "src/modules/proof-session/app/get_proof_session_controller.ts",
    "src/modules/proof-session/app/get_proof_session_presenter.ts",
    "src/modules/proof-session/app/get_proof_session_usecase.ts",
    "src/modules/proof-session/app/get_proof_session_viewmodel.ts",
  ];

  expectedModuleFiles.forEach(assertFileExists);

  const invalidNames = walkFiles("src/modules")
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !/^[a-z0-9_]+_(controller|presenter|usecase|viewmodel)\.ts$/.test(path.basename(file)));

  assert.deepEqual(invalidNames, []);
});

test("Story 1.1 centralizes process.env access in src/shared/environments.ts", () => {
  const environmentSource = readText("src/shared/environments.ts");

  [
    "ISSUER_PRIVATE_KEY",
    "WEBHOOK_SIGNING_PRIVATE_KEY",
    "BLOCKCHAIN_WALLET_PRIVATE_KEY",
  ].forEach((envName) => {
    assert.match(environmentSource, new RegExp(`${envName}: z\\.string\\(\\)\\.optional\\(\\)`));
  });

  // Story 10.2: endereço do contrato e placeholders do TEST_ENV validados no superRefine.
  // (A validação de formato hex das 3 chaves privadas foi removida a pedido.)
  assert.match(environmentSource, /ethers\.isAddress\(values\.BLOCKCHAIN_CONTRACT_ADDRESS\)/);
  assert.match(
    environmentSource,
    /is set to a known TEST_ENV placeholder value, which must never be used outside the TEST stage/
  );

  // Story 10.1: ISSUER_PRIVATE_KEY/WEBHOOK_SIGNING_PRIVATE_KEY carregam os valores hex prontos
  // diretamente (não mais um placeholder "test-..." remendado no ponto de consumo).
  assert.match(environmentSource, /ISSUER_PRIVATE_KEY:\s*\n?\s*"[0-9a-f]{64}"/);
  assert.match(environmentSource, /WEBHOOK_SIGNING_PRIVATE_KEY:\s*\n?\s*"[0-9a-f]{64}"/);
  // BLOCKCHAIN_WALLET_PRIVATE_KEY permanece com o placeholder — fora do escopo da Story 10.1
  // (nenhum consumidor faz hexToBytes desse valor em TEST stage).
  assert.match(environmentSource, /BLOCKCHAIN_WALLET_PRIVATE_KEY: "test-/);

  const scannedFiles = [
    ...walkFiles("app"),
    ...walkFiles("components"),
    ...walkFiles("src"),
    ...walkFiles("utils"),
  ].filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file));

  const processEnvReaders = scannedFiles
    .filter((file) => readText(file).includes("process.env"))
    .map((file) => file.replace(/\\/g, "/"));

  assert.deepEqual(processEnvReaders, ["src/shared/environments.ts"]);
});

test("Story 1.1 removes obsolete folders and stale import paths", () => {
  [
    "app/(dashboard)/apps/novo",
    "app/onboarding",
    "modules",
    "shared",
    "lib",
  ].forEach(assertPathMissing);

  const scannedFiles = [
    ...walkFiles("app"),
    ...walkFiles("components"),
    ...walkFiles("src"),
    ...walkFiles("utils"),
  ].filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file));

  const staleImports = scannedFiles.filter((file) => {
    const source = readText(file);
    return source.includes("@/lib/") || source.includes("@/shared/config/");
  });

  assert.deepEqual(staleImports, []);
});

test("Story 1.1 preserves user and API flow entrypoints", () => {
  [
    "app/sign-in/page.tsx",
    "app/(dashboard)/apps/page.tsx",
    "app/(dashboard)/apps/new/page.tsx",
    "app/(dashboard)/apps/[appId]/page.tsx",
    "app/(dashboard)/proof-requests/page.tsx",
    "app/(dashboard)/proof-requests/[requestId]/page.tsx",
    "app/v/[sessionToken]/page.tsx",
    "app/api/auth/sign-out/route.ts",
    "app/api/companies/route.ts",
    "app/api/companies/me/route.ts",
    "app/api/company-apps/route.ts",
    "app/api/company-apps/[appId]/route.ts",
    "app/api/proof-requests/route.ts",
    "app/api/proof-requests/[requestId]/route.ts",
    "app/api/proof-sessions/[sessionToken]/route.ts",
  ].forEach(assertFileExists);
});

test.skip("Story 1.1 migrated imports compile without TypeScript errors", { timeout: 120_000 }, () => {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["tsc", "--noEmit"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      STAGE: "TEST",
    },
    stdio: "pipe",
    shell: process.platform === "win32",
  });
});
