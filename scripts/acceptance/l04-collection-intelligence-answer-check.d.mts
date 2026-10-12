export const L04_SYNTHETIC_COLLECTION_INPUT: Readonly<{ maxItems: number }>;
export type L04CollectionIntelligenceFacts = Readonly<{
  topTag: string;
  topTagCount: number;
  observedRows: number;
  sourceTotal: number;
  state: string;
}>;
export const L04_SYNTHETIC_COLLECTION_FACTS: L04CollectionIntelligenceFacts;
export function checkL04CollectionIntelligenceAnswer(
  answer: unknown,
  facts?: L04CollectionIntelligenceFacts,
): {
  accepted: boolean;
  checks: Record<string, boolean>;
};
