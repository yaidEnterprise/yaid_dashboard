import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const VIEWMODEL = "src/modules/proof-request/app/create_proof_request_viewmodel.ts";
const USECASE = "src/modules/proof-request/app/create_proof_request_usecase.ts";
const ROUTE = "app/api/proof-requests/route.ts";
const PAGE = "app/(dashboard)/proof-requests/new/page.tsx";

describe("Story 3.4 — proof request helper", () => {
  test("supports appId in the create-proof-request payload for session-auth flow", () => {
    const src = readText(VIEWMODEL);
    assert.match(src, /appId:/, "DTO must support appId for dashboard helper submissions");
    assert.match(src, /z\.string\(\)\.uuid\(\)\.optional\(\)\.nullable\(\)/, "appId should be an optional UUID field");
  });

  test("use case resolves the selected app from the company session and enforces company ownership", () => {
    const src = readText(USECASE);
    assert.match(src, /companyId/, "session-auth flow must receive companyId");
    assert.match(src, /input\.body\.appId/, "use case must resolve the selected app from the request body");
    assert.match(src, /companyId !== input\.companyId/, "app must belong to the authenticated company");
  });

  test("POST /api/proof-requests accepts session-auth requests without an API key", () => {
    const src = readText(ROUTE);
    assert.match(src, /x-company-id/, "route must forward the session company id");
    assert.match(src, /companyId/, "route must pass companyId into the controller");
  });

  test("dashboard page posts to /api/proof-requests with appId and the selected proof type", () => {
    const src = readText(PAGE);
    assert.match(src, /fetchWithAuth\("\/api\/proof-requests"/, "dashboard helper must call the internal proof-request endpoint");
    assert.match(src, /appId:/, "payload must include the selected appId");
    assert.match(src, /proofType:/, "payload must include the selected proofType");
  });
});
