export interface SafeCandidate {
  readonly id: string; // opaque
  readonly label: string; // basename only
  readonly origin: "vscode" | "vscode-insiders" | "manual";
  readonly confidence: "high" | "medium" | "low";
  readonly mtimeMs: number;
  readonly sizeBytes: number;
  readonly contextLabel?: string;
}
