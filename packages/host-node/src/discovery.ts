// Discovery — finds candidate AHP log files for the picker UI.
// Phase 1: returns []. Real implementation lands in Phase 4 (INGEST-02).

import type { LogCandidate } from "@ahp-viewer/shared";

/**
 * TODO(INGEST-02 / Phase 4): walk known VS Code log roots
 *   - macOS:   ~/Library/Application Support/Code{,-Insiders}/logs/
 *   - Linux:   ~/.config/Code{,-Insiders}/logs/
 *   - Windows: %APPDATA%\Code{,-Insiders}\logs\
 * Filter for `agenthost.*.log` patterns; return one LogCandidate per match.
 */
export async function discoverVsCodeLogs(): Promise<LogCandidate[]> {
  return [];
}
