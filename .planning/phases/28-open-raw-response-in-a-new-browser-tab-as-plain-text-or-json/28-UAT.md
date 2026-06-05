---
status: complete
phase: 28-open-raw-response-in-a-new-browser-tab-as-plain-text-or-json
source: [28-01-SUMMARY.md]
started: 2026-05-31T17:30:00.000Z
updated: 2026-06-05T00:00:00.000Z
---

## Current Test

(complete)

## Tests

### 1. Open raw payload in a new tab (JSON)
expected: "Actions" menu shows "Open in new tab (JSON)" + "Open in new tab (text)"; JSON action opens a new tab with the pretty-printed payload and an "Opened in new tab" toast.
result: pass

### 2. Open raw payload in a new tab (text)
expected: "Open in new tab (text)" opens a new tab showing the payload as plain text.
result: pass

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Notes

- UAT feedback: the action originally lived under a dropdown labeled "Copy",
  which misrepresented its contents. Resolved during UAT by renaming the
  dropdown trigger to "Actions" (commit de37a9b); menu item labels unchanged.

## Gaps

<!-- none -->
