export interface OcrResult {
  name: string;
  cpf: string;
  birthDate: string; // Formato: YYYY-MM-DD
}

export interface OcrProvider {
  processDocument(base64Image: string): Promise<OcrResult>;
}
