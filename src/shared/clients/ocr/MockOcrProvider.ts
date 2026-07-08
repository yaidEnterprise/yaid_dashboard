import { OcrProvider, OcrResult } from "@/shared/domain/interfaces/OcrProvider";

export class MockOcrProvider implements OcrProvider {
  async processDocument(base64Image: string): Promise<OcrResult> {
    if (
      base64Image === "fail" ||
      base64Image === "invalid" ||
      base64Image.includes("fail") ||
      base64Image.includes("invalid")
    ) {
      throw new Error("Document processing failed");
    }

    if (base64Image.includes("under18")) {
      return {
        name: "Mock Under18 Holder",
        cpf: "123.456.789-00",
        birthDate: "2015-01-01",
      };
    }

    return {
      name: "Mock Holder",
      cpf: "123.456.789-00",
      birthDate: "2000-01-01",
    };
  }
}
