import { createHash, timingSafeEqual } from "node:crypto";
import { ApiKeyHasher } from "@/shared/domain/interfaces/ApiKeyHasher";

export class Sha256ApiKeyHasher implements ApiKeyHasher {
  async hash(secret: string): Promise<string> {
    return createHash("sha256").update(secret).digest("hex");
  }

  async verify(secret: string, hash: string): Promise<boolean> {
    const candidate = createHash("sha256").update(secret).digest();
    let expected: Buffer;
    try {
      expected = Buffer.from(hash, "hex");
    } catch {
      return false;
    }
    if (expected.length !== candidate.length) return false;
    return timingSafeEqual(candidate, expected);
  }
}
