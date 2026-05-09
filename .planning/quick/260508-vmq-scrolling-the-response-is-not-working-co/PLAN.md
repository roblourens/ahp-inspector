---
quick_id: 260508-vmq
slug: scrolling-the-response-is-not-working-co
status: planned
created: "2026-05-09T05:46:29.242Z"
---

Fix response detail scrolling and noisy serverSeq gap banners.

Tasks:
1. Constrain the desktop detail rail and detail panel flex layout so the JSON response view can scroll to its full bottom.
2. Preserve the actual previous serverSeq in row projection metadata and use global serverSeq ordering for gap detection.
3. Update gap banner selectors/tests so banners show true missing counts and do not appear for contiguous, duplicate, or out-of-order values.
4. Run focused tests for detail panel, app shell, selectors, and row projection.
