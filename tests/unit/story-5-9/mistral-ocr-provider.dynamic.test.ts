/**
 * Story 5.9 — teste dinâmico/comportamental do MistralOcrProvider.
 *
 * Diferente do teste estrutural de `mistral-ocr-provider-selection.test.mjs`
 * (regex sobre o source), este arquivo instancia o provider real e mocka
 * apenas `client.ocr.process` (o único ponto de I/O de rede da classe) via
 * `node:test`'s `mock.method`, verificando o comportamento efetivo de
 * `processDocument` em runtime: parsing de `documentAnnotation`, validação
 * estrutural de name/cpf/birthDate, e os casos de rejeição (422) reportados
 * no code review desta story — data de calendário inválida, ano de
 * nascimento implausível, MIME de imagem não reconhecido.
 *
 * Executado via `tsx` (não `node --test` puro) pelos aliases `@/...` do
 * tsconfig — mesmo padrão estabelecido pela Story 5.8/9.1.
 */

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { MistralOcrProvider } from "@/shared/clients/ocr/MistralOcrProvider";

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BASE64 = PNG_MAGIC_BYTES.toString("base64");

function mockOcrResponse(provider: MistralOcrProvider, documentAnnotation: string | null | undefined) {
  const client = (provider as unknown as { client: { ocr: { process: (...args: unknown[]) => unknown } } }).client;
  return mock.method(client.ocr, "process", async () => ({
    model: "mistral-ocr-latest",
    pages: [],
    documentAnnotation,
    usageInfo: { pagesProcessed: 1, docSizeBytes: 100 },
  }));
}

test("Story 5.9 (dynamic) AC#1 — valid structured annotation returns { name, cpf, birthDate }", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  const mockFn = mockOcrResponse(
    provider,
    JSON.stringify({ name: "Maria da Silva", cpf: "123.456.789-00", birthDate: "1990-05-15" })
  );

  const result = await provider.processDocument(PNG_BASE64);

  assert.deepEqual(result, { name: "Maria da Silva", cpf: "12345678900", birthDate: "1990-05-15" });
  assert.equal(mockFn.mock.calls.length, 1);
  const [request] = mockFn.mock.calls[0].arguments as [{ documentAnnotationFormat: unknown; document: { imageUrl: string } }];
  assert.match(request.document.imageUrl, /^data:image\/png;base64,/);
  assert.ok(request.documentAnnotationFormat, "must request structured document annotation");
});

test("Story 5.9 (dynamic) AC#3 — CPF normalized but wrong digit count is rejected (422 upstream)", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  mockOcrResponse(
    provider,
    JSON.stringify({ name: "Maria da Silva", cpf: "123.456.789", birthDate: "1990-05-15" })
  );

  await assert.rejects(
    () => provider.processDocument(PNG_BASE64),
    /Document processing failed/
  );
});

test("Story 5.9 (dynamic) AC#3 — null field from the model is rejected, never silently accepted", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  mockOcrResponse(provider, JSON.stringify({ name: null, cpf: "123.456.789-00", birthDate: "1990-05-15" }));

  await assert.rejects(() => provider.processDocument(PNG_BASE64), /Document processing failed/);
});

test("Story 5.9 (dynamic) AC#3 — future birthDate is rejected", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  const futureYear = new Date().getUTCFullYear() + 5;
  mockOcrResponse(
    provider,
    JSON.stringify({ name: "Maria da Silva", cpf: "123.456.789-00", birthDate: `${futureYear}-01-01` })
  );

  await assert.rejects(() => provider.processDocument(PNG_BASE64), /Document processing failed/);
});

test("Story 5.9 (dynamic, review regression) calendar-invalid birthDate (Feb 29 on non-leap year) is rejected, not silently rolled over", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  mockOcrResponse(
    provider,
    JSON.stringify({ name: "Maria da Silva", cpf: "123.456.789-00", birthDate: "2023-02-29" })
  );

  await assert.rejects(() => provider.processDocument(PNG_BASE64), /Document processing failed/);
});

test("Story 5.9 (dynamic, review regression) implausible birth year below MIN_BIRTH_YEAR is rejected", async () => {
  // Year 1800 is unambiguous under Date.UTC (unlike years 0-99, which get
  // remapped to 1900-1999 by JS's legacy two-digit-year rule) — isolates the
  // MIN_BIRTH_YEAR guard from the calendar-rollover check.
  const provider = new MistralOcrProvider("fake-api-key");
  mockOcrResponse(
    provider,
    JSON.stringify({ name: "Maria da Silva", cpf: "123.456.789-00", birthDate: "1800-01-01" })
  );

  await assert.rejects(() => provider.processDocument(PNG_BASE64), /Document processing failed/);
});

test("Story 5.9 (dynamic) AC#2 — missing documentAnnotation (model found nothing) is rejected", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  mockOcrResponse(provider, null);

  await assert.rejects(() => provider.processDocument(PNG_BASE64), /Document processing failed/);
});

test("Story 5.9 (dynamic) malformed JSON in documentAnnotation is rejected instead of throwing a raw SyntaxError", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  mockOcrResponse(provider, "{not valid json");

  await assert.rejects(() => provider.processDocument(PNG_BASE64), /Document processing failed/);
});

test("Story 5.9 (dynamic, review regression) unrecognized image format (no PNG/JPEG magic bytes) is rejected before calling the API", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  const mockFn = mockOcrResponse(
    provider,
    JSON.stringify({ name: "Maria da Silva", cpf: "123.456.789-00", birthDate: "1990-05-15" })
  );

  const notAnImage = Buffer.from("not an image at all").toString("base64");
  await assert.rejects(() => provider.processDocument(notAnImage), /Document processing failed/);
  assert.equal(mockFn.mock.calls.length, 0, "must not call the OCR API for an unrecognized image format");
});

test("Story 5.9 (dynamic) JPEG magic bytes are detected and tagged as image/jpeg in the data URI", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  const mockFn = mockOcrResponse(
    provider,
    JSON.stringify({ name: "Maria da Silva", cpf: "123.456.789-00", birthDate: "1990-05-15" })
  );

  const jpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64");
  await provider.processDocument(jpegBase64);

  const [request] = mockFn.mock.calls[0].arguments as [{ document: { imageUrl: string } }];
  assert.match(request.document.imageUrl, /^data:image\/jpeg;base64,/);
});

test("Story 5.9 (dynamic) name shorter than 3 chars after trim is rejected", async () => {
  const provider = new MistralOcrProvider("fake-api-key");
  mockOcrResponse(provider, JSON.stringify({ name: "  A  ", cpf: "123.456.789-00", birthDate: "1990-05-15" }));

  await assert.rejects(() => provider.processDocument(PNG_BASE64), /Document processing failed/);
});
