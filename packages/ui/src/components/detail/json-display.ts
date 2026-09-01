const UNDEFINED_VALUE = "[Undefined value]";
const NON_SERIALIZABLE_VALUE = "[Circular or non-serializable value]";

export interface PreparedJson {
  readonly compactText: string;
  readonly prettyText: string;
  readonly treeData: object;
}

function fallback(value: string): PreparedJson {
  return {
    compactText: value,
    prettyText: value,
    treeData: { value },
  };
}

export function prepareJson(value: unknown): PreparedJson {
  let compactText: string | undefined;
  try {
    compactText = JSON.stringify(value);
  } catch {
    return fallback(NON_SERIALIZABLE_VALUE);
  }

  if (compactText === undefined) return fallback(UNDEFINED_VALUE);

  try {
    const parsed: unknown = JSON.parse(compactText);
    const prettyText = JSON.stringify(parsed, null, 2);
    return {
      compactText,
      prettyText: prettyText ?? compactText,
      treeData: parsed !== null && typeof parsed === "object" ? parsed : { value: parsed },
    };
  } catch {
    return fallback(NON_SERIALIZABLE_VALUE);
  }
}
