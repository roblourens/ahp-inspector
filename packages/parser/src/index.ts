// Public barrel for @ahp-inspector/parser. Legacy adapter is intentionally NOT
// re-exported here — consumers must import it via the dedicated path
// (Pitfall 6) so it is provably isolated from core/UI.

export type { ParsedLine } from "./jsonl.js";
export { LineSplitter, MAX_BUF_BYTES, ParseOverflowError, parseLine } from "./jsonl.js";
export { normalize } from "./normalizer.js";
