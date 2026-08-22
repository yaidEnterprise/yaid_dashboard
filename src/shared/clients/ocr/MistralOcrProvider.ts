import { Mistral } from "@mistralai/mistralai";
import { OcrProvider, OcrResult } from "@/shared/domain/interfaces/OcrProvider";

const MISTRAL_OCR_MODEL = "mistral-ocr-latest";
const OCR_TIMEOUT_MS = 30_000;

const DOCUMENT_ANNOTATION_SCHEMA = {
  type: "json_schema" as const,
  jsonSchema: {
    name: "brazilian_id_document",
    strict: true,
    schemaDefinition: {
      type: "object",
      properties: {
        name: {
          type: ["string", "null"],
          description: "Nome civil completo do titular, exatamente como impresso",
        },
        cpf: {
          type: ["string", "null"],
          description: "CPF do titular, apenas dígitos",
        },
        birthDate: {
          type: ["string", "null"],
          description:
            "Data de nascimento do titular em YYYY-MM-DD. Nunca usar data de emissão, expedição ou validade",
        },
      },
      required: ["name", "cpf", "birthDate"],
      additionalProperties: false,
    },
  },
};

function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  throw new Error("Document processing failed");
}

function toDataUri(base64Image: string): string {
  const buffer = Buffer.from(base64Image, "base64");
  const mime = detectMimeType(buffer);
  return `data:${mime};base64,${base64Image}`;
}

interface RawAnnotation {
  name: unknown;
  cpf: unknown;
  birthDate: unknown;
}

const MIN_BIRTH_YEAR = 1900;

function isValidBirthDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (year < MIN_BIRTH_YEAR) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(date.getTime())) {
    return false;
  }

  // Reject calendar-invalid dates (e.g. "2023-02-29") instead of letting
  // Date silently roll them over to the next valid day.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  return date.getTime() <= Date.now();
}

function validateOcrResult(raw: RawAnnotation): OcrResult {
  if (typeof raw.name !== "string") {
    throw new Error("Document processing failed");
  }
  const name = raw.name.trim();
  if (name.length < 3) {
    throw new Error("Document processing failed");
  }

  if (typeof raw.cpf !== "string") {
    throw new Error("Document processing failed");
  }
  const cpf = raw.cpf.replace(/\D/g, "");
  if (cpf.length !== 11) {
    throw new Error("Document processing failed");
  }

  if (typeof raw.birthDate !== "string" || !isValidBirthDate(raw.birthDate)) {
    throw new Error("Document processing failed");
  }

  return { name, cpf, birthDate: raw.birthDate };
}

export class MistralOcrProvider implements OcrProvider {
  private readonly client: Mistral;

  constructor(apiKey: string) {
    this.client = new Mistral({ apiKey });
  }

  async processDocument(base64Image: string): Promise<OcrResult> {
    const response = await this.client.ocr.process(
      {
        model: MISTRAL_OCR_MODEL,
        document: { type: "image_url", imageUrl: toDataUri(base64Image) },
        documentAnnotationFormat: DOCUMENT_ANNOTATION_SCHEMA,
        includeImageBase64: false,
      },
      { timeoutMs: OCR_TIMEOUT_MS }
    );

    if (!response.documentAnnotation) {
      throw new Error("Document processing failed");
    }

    let parsed: RawAnnotation;
    try {
      parsed = JSON.parse(response.documentAnnotation);
    } catch {
      throw new Error("Document processing failed");
    }

    return validateOcrResult(parsed);
  }
}
