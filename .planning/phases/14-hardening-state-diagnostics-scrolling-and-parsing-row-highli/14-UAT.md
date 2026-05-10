---
status: testing
phase: 14-hardening-state-diagnostics-scrolling-and-parsing-row-highli
source:
  - 14-01-SUMMARY.md
  - 14-02-SUMMARY.md
  - 14-03-SUMMARY.md
  - 14-04-SUMMARY.md
started: 2026-05-09T22:00:00Z
updated: 2026-05-09T22:00:00Z
---

## Current Test

number: 5
name: Notification summary — protocol notification with state
expected: |
  A protocol-notification row whose payload includes a state/status field
  (e.g., session/update with state "running") shows summary like
  "notification session/update running" instead of a JSON-ish dump.
awaiting: user response

## Tests

### 1. State diagnostics scroll within panel
expected: Diagnostics list with many entries scrolls inside its own ~240px panel; rest of inspector unaffected.
result: pass

### 2. Diagnostic rows show parsed meta + wrapping message
expected: Each diagnostic shows a meta header (severity · code · event #N) on its own line, with the message body below wrapping cleanly (no horizontal overflow on long messages).
result: pass

### 2. Diagnostic rows show parsed meta + wrapping message
expected: Each diagnostic shows a meta header (severity · code · event #N) on its own line, with the message body below wrapping cleanly (no horizontal overflow on long messages).
result: pass

### 3. Row highlight precedence — selected wins
expected: A row that is currently selected, also a search match, AND has a hidden-pair highlight shows ONLY the selected background. There is no extra outline competing with the selection.
result: pass
note: "User clarified: original concern was sibling pair-highlighted rows overlapping with selection bg, not the outline. Precedence rule (selected > pair > search) addresses both."

### 4. Search-match rail indicator (not selected)
expected: A row that is a search match but NOT selected shows a subtle background tint AND its left rail is colored with the search-match yellow/highlight color (instead of the row's normal rail color).
result: pass

### 5. Notification summary — protocol notification with state
expected: A protocol-notification row whose payload includes a state/status field (e.g., session/update with state "running") shows summary like "notification session/update running" instead of a JSON-ish dump.
result: [pending]

### 6. Notification summary — server/client notification with message
expected: A server-notification with a message field (e.g., window/showMessage) shows summary "{method}: {message}" (clipped to ~160 chars).
result: [pending]

### 7. Search ergonomics — Enter / Shift+Enter cycles matches
expected: With the search input focused and a query that has matches, pressing Enter selects the next match; Shift+Enter selects the previous. Behavior matches existing F3 / Shift+F3.
result: [pending]

### 8. Search ergonomics — selected match scrolls into view
expected: After selecting a match (via Enter, Shift+Enter, or F3), the timeline virtualizer scrolls so the selected row is visible and roughly centered. Tail-follow is disabled while navigating matches.
result: [pending]

## Summary

total: 8
passed: 4
issues: 0
pending: 4
skipped: 0

## Gaps

[none yet]
