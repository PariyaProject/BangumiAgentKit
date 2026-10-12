export const L04_SYNTHETIC_COLLECTION_INPUT: Readonly<{ maxItems: number }>;
export const L04_SYNTHETIC_COLLECTION_FACTS: Readonly<{
  topTag: string;
  topTagCount: number;
  observedRows: number;
  sourceTotal: number;
  state: string;
}>;
export function checkL04CollectionIntelligenceAnswer(answer: unknown): {
  accepted: boolean;
  checks: Record<string, boolean>;
};
