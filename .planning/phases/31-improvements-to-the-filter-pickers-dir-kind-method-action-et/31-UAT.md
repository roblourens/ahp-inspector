---
status: complete
phase: 31-improvements-to-the-filter-pickers-dir-kind-method-action-et
source: [31-01-SUMMARY.md, 31-02-SUMMARY.md]
started: 2026-06-12T01:22:42Z
updated: 2026-06-12T01:50:00Z
---

## Current Test

(complete)

## Tests

### 1. Contextual complete-set picker behavior
expected: Default Method shows unchecked `ping`, one `Select all`, no `Uncheck all`, and no visible `Close`; the command selects the complete set even while a local query hides options.
result: pass

### 2. Deterministic option ordering
expected: Categorical picker rows appear in case-insensitive visible-label order with stable raw-value ties and visible counts.
result: pass

### 3. Desktop, narrow, and Group geometry
expected: Search input, contextual footer, and rows remain inside the open picker; the narrow picker is visibly painted inside the viewport; selected Group: Session background stays inside the Group popover.
result: pass

### 4. Theme and privacy evidence
expected: Dark, Light, and Hacker picker surfaces are readable and every saved screenshot contains only fixture/synthetic content without absolute paths.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Notes

- Five fixture-only screenshots were generated and visually inspected.
- Browser evidence exposed narrow-toolbar clipping that bounding boxes alone did not reveal; this was fixed with feature-detected CSS anchor positioning and a trigger-relative fallback.
- Final independent review found no remaining issues.

## Gaps

<!-- none -->
