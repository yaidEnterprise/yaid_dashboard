import { OcrProvider, OcrResult } from "@/shared/domain/interfaces/OcrProvider";

/**
 * Extrai dados estruturados (nome, CPF, data de nascimento) a partir
 * do texto bruto retornado pela API de OCR, usando regex para documentos
 * brasileiros (RG, CNH, etc.).
 */
function parseDocumentText(rawText: string): OcrResult {
  const text = rawText.replace(/\r\n/g, "\n");

  // ── CPF ──────────────────────────────────────────────────────────────
  // Formato canônico: 123.456.789-00
  // Variações OCR:    123.456.789/00, sem pontuação (11 dígitos seguidos)
  // Usa word-boundary para não colar com datas ou outros números
  const cpfPatterns = [
    /\d{3}\.\d{3}\.\d{3}[-/]\d{2}/,          // 123.456.789-00
    /(?<!\d)\d{3}\s\d{3}\s\d{3}\s?\d{2}(?!\d)/, // 123 456 789 00 (OCR com espaços)
    /(?<!\d)\d{11}(?!\d)/,                     // 12345678900 (sem formatação)
  ];

  let cpf: string | null = null;
  for (const pattern of cpfPatterns) {
    const match = text.match(pattern);
    if (match) {
      cpf = match[0].replace(/\s/g, "");
      break;
    }
  }

  if (!cpf) {
    throw new Error("Document processing failed: CPF not found");
  }

  // ── Data de Nascimento ───────────────────────────────────────────────
  // Procura por label "NASCIMENTO", "DATA NASC", "D.NASCIMENTO", "DN"
  // seguido de data no formato DD/MM/YYYY ou DD.MM.YYYY
  const dateWithLabelPatterns = [
    // Label na mesma linha: "DATA DE NASCIMENTO 15/03/1990" ou "DATA DE NASCIMENTO: 15/03/1990"
    /(?:DATA\s*(?:DE\s*)?NASCIMENTO|D\.?\s*NASCIMENTO|DATA\s*NASC\.?|DT\.?\s*NASC\.?|DN)\s*[:\s.\-/]*(\d{2})[/.\-](\d{2})[/.\-](\d{4})/i,
    // Label em uma linha e data na próxima: "NASCIMENTO\n15/03/1990"
    /(?:DATA\s*(?:DE\s*)?NASCIMENTO|NASCIMENTO|DATA\s*NASC\.?|DT\.?\s*NASC\.?)\s*\n\s*(\d{2})[/.\-](\d{2})[/.\-](\d{4})/i,
  ];

  // Fallback: qualquer data DD/MM/YYYY no texto
  const dateFallbackPattern = /(\d{2})[/.\-](\d{2})[/.\-](\d{4})/;

  let birthDate: string | null = null;

  // Tentar primeiro com label
  for (const pattern of dateWithLabelPatterns) {
    const match = text.match(pattern);
    if (match) {
      const [day, month, year] = [match[1], match[2], match[3]];
      if (isValidDate(day, month, year)) {
        birthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        break;
      }
    }
  }

  // Fallback sem label
  if (!birthDate) {
    const match = text.match(dateFallbackPattern);
    if (match) {
      const [, day, month, year] = match;
      if (isValidDate(day, month, year)) {
        birthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
  }

  if (!birthDate) {
    throw new Error("Document processing failed: birth date not found");
  }

  // ── Nome ─────────────────────────────────────────────────────────────
  // Procura por label "NOME" seguido do nome real
  const namePatterns = [
    // "NOME" seguido de texto na mesma linha (para na próxima keyword ou quebra de linha)
    /(?:NOME\s*(?:COMPLETO|CIVIL)?)\s*[:\-]?\s*([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑa-záàâãéèêíïóôõöúçñ\s'.]+?)(?:\n|$|\s{2,}(?:CPF|RG|CNH|DOC|DATA|NASCIMENTO|FILIAÇÃO|FILIACAO|REGISTRO|VALIDADE|DT|DN|CAT))/i,
    // "NOME" seguido de quebra de linha e o nome na próxima linha
    /(?:NOME\s*(?:COMPLETO|CIVIL)?)\s*\n+\s*([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑa-záàâãéèêíïóôõöúçñ\s'.]+?)(?:\n|$)/i,
  ];

  let name: string | null = null;
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleaned = match[1].trim().replace(/\s{2,}/g, " ");

      if (cleaned.length >= 3) {
        name = cleaned;
        break;
      }
    }
  }

  if (!name) {
    throw new Error("Document processing failed: name not found");
  }

  return { name, cpf, birthDate };
}

function isValidDate(day: string, month: string, year: string): boolean {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100;
}

export class ApiOcrProvider implements OcrProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string
  ) {}

  async processDocument(base64Image: string): Promise<OcrResult> {
    // Converter base64 para Buffer/Blob para envio como form-data
    const imageBuffer = Buffer.from(base64Image, "base64");
    const imageBlob = new Blob([imageBuffer], { type: "image/png" });

    const formData = new FormData();
    formData.append("image", imageBlob, "document.png");
    formData.append("lang", "por");

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Document processing failed");
    }

    const data = await response.json();

    if (!data.text || typeof data.text !== "string") {
      throw new Error("Document processing failed");
    }

    return parseDocumentText(data.text);
  }
}
