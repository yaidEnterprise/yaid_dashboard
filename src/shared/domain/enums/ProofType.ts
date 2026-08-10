export enum ProofType {
  PERSONHOOD = "personhood",
  AGE_OVER_18 = "age_over_18",
}

// Vocabulário canônico: proof_type na API/banco é snake_case; a chave de claim dentro da VC é
// camelCase. Este é o único lugar do mapeamento entre as duas formas.
export const PROOF_TYPE_CLAIM_KEY: Record<ProofType, "personhood" | "ageOver18"> = {
  [ProofType.PERSONHOOD]: "personhood",
  [ProofType.AGE_OVER_18]: "ageOver18",
};
