import { createHash, timingSafeEqual } from "node:crypto";
import { ApiKeyHasher } from "../../domain/services/ApiKeyHasher";

/**
 * Deterministic SHA-256 hash. Adequate for high-entropy machine-generated
 * API secrets (we generate 32 random bytes per app). Not suitable for
 * user-chosen passwords — use Argon2/bcrypt for those.
 */
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
