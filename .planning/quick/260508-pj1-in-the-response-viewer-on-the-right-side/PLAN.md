---
phase: quick-260508-pj1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/ui/src/components/detail/DetailPanel.tsx
  - packages/ui/src/components/detail/DetailPanel.test.tsx
autonomous: true
requirements:
  - QUICK-PJ1-01
must_haves:
  truths:
    - "User can scroll vertically inside the right-side response viewer when JSON content overflows."
    - "Scrolling works in both the Pretty and Raw tabs."
    - "Sibling regions (Summary, AhpFieldStrip, StateInspectorPanel, tab header, PrivacyCaption) remain visible and are not pushed off-screen by tall JSON payloads."
  artifacts:
    - path: "packages/ui/src/components/detail/DetailPanel.tsx"
      provides: "Tabpanel wrapper with minHeight: 0 so it can shrink inside the column flex aside, exposing inner overflow."
    - path: "packages/ui/src/components/detail/DetailPanel.test.tsx"
      provides: "Regression test asserting the tabpanel has the styles required to scroll (overflow auto + minHeight 0)."
  key_links:
    - from: "DetailPanel aside (flex column, overflow:hidden)"
      to: "tabpanel div (flex:1)"
      via: "minHeight:0 on tabpanel allows it to shrink so its overflow:auto becomes effective"
      pattern: "minHeight: 0"
---

<objective>
Fix missing vertical scrolling in the right-side response viewer (`DetailPanel`).
Both the Pretty and Raw tabs render inside a `flex: 1; overflow: auto` tabpanel
nested inside a column-flex aside. Without `minHeight: 0` on the tabpanel (and
its inner views as a safety net), the flex child cannot shrink below its
content's intrinsic height, so the inner `overflow: auto` never activates and
the panel grows past the aside, leaving no scrollbar.

Purpose: Restore basic scrollability of large JSON payloads in the detail view.
Output: Minimal CSS change in `DetailPanel.tsx` plus a regression test.
</objective>

<context>
@packages/ui/src/components/detail/DetailPanel.tsx
@packages/ui/src/components/detail/DetailPanel.test.tsx
@packages/ui/src/components/detail/PrettyJsonView.tsx
@packages/ui/src/components/detail/RawJsonView.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add regression test for tabpanel scroll styles</name>
  <files>packages/ui/src/components/detail/DetailPanel.test.tsx</files>
  <behavior>
    - When DetailPanel renders the Pretty tab, the element with `role="tabpanel"`
      has computed inline styles `overflow: auto`, `flex: 1`, and `min-height: 0`.
    - When the user switches to the Raw tab, the same `role="tabpanel"`
      element still carries `overflow: auto` and `min-height: 0`.
    Test should fail before the fix in Task 2 (current code lacks `minHeight: 0`).
  </behavior>
  <action>
    Append a new `describe("DetailPanel — scrollable JSON tabpanel", ...)` block
    to `DetailPanel.test.tsx` following the existing test style:
    - Use `vi.mocked(fetchEvent).mockResolvedValue(makeDetailResponse(...))`
      with a normal event payload.
    - Set `useAppStore.setState({ selectedIdx: 0, rows: [makeRow()] })`.
    - `render(<DetailPanel />)`, `await waitFor` on `detail-summary`.
    - Get the tabpanel via `screen.getByRole("tabpanel")`.
    - Assert `tabpanel.style.overflow === "auto"`, `tabpanel.style.flex` includes `"1"`,
      and `tabpanel.style.minHeight === "0px"` (or `"0"`).
    - Add a second test that clicks the Raw tab (`fireEvent.click(screen.getByRole("tab", { name: /raw/i }))`)
      and re-asserts the same styles still hold on the (now Raw) tabpanel.
    Do not modify any existing tests. Do not add testids to product code from this task.
  </action>
  <verify>
    <automated>pnpm --filter @ahp-viewer/ui test -- DetailPanel.test.tsx</automated>
  </verify>
  <done>New tests exist and FAIL with a message indicating `minHeight` is empty / not "0px".</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add minHeight: 0 to tabpanel so flex child can shrink</name>
  <files>packages/ui/src/components/detail/DetailPanel.tsx</files>
  <behavior>
    - The `<div role="tabpanel">` style object includes `minHeight: 0` in addition
      to existing `flex: 1`, `overflow: "auto"`, `display: "flex"`, `flexDirection: "column"`.
    - No other styles, props, or surrounding markup change.
    - The Task 1 regression tests now pass.
  </behavior>
  <action>
    In `packages/ui/src/components/detail/DetailPanel.tsx`, locate the JSON view
    block (currently around line 391-399):

    ```tsx
    <div
      role="tabpanel"
      style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}
    >
    ```

    Update the inline style to include `minHeight: 0`:

    ```tsx
    <div
      role="tabpanel"
      style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}
    >
    ```

    Rationale (do NOT add as a code comment): in a column flex container, a
    `flex: 1` child defaults to `min-height: auto`, which is its content size.
    That prevents the child from shrinking below its content, so its own
    `overflow: auto` never activates. Setting `minHeight: 0` lets it shrink to
    fit the aside, at which point `overflow: auto` produces a scrollbar.

    Do not change `PrettyJsonView`, `RawJsonView`, the aside wrapper, or any
    other sibling styles. Do not add new files. Do not introduce CSS classes.
  </action>
  <verify>
    <automated>pnpm --filter @ahp-viewer/ui test -- DetailPanel.test.tsx</automated>
  </verify>
  <done>
    Both Task 1 regression tests pass. Existing DetailPanel tests still pass.
    Diff is limited to a single inline-style object in `DetailPanel.tsx`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Repo-wide verification</name>
  <files>(no file changes)</files>
  <action>
    Run the broader UI test suite and typecheck/lint to confirm no collateral
    damage from the style change.
  </action>
  <verify>
    <automated>pnpm --filter @ahp-viewer/ui test && pnpm --filter @ahp-viewer/ui typecheck 2>/dev/null || pnpm --filter @ahp-viewer/ui exec tsc --noEmit</automated>
  </verify>
  <done>UI package tests pass and TypeScript reports no new errors.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Vertical scrolling restored in the right-side response viewer for both
    Pretty and Raw tabs by adding `minHeight: 0` to the tabpanel flex child.
  </what-built>
  <how-to-verify>
    1. `pnpm --filter @ahp-viewer/ui dev` (or run the standard local launch).
    2. Open a log with at least one event whose JSON payload is taller than the
       detail panel (any large `tools/list` response or a fixture from
       `test/fixtures/long-realistic-ahp.jsonl` works).
    3. Select that event so the right-side `DetailPanel` populates.
    4. On the Pretty tab: confirm a vertical scrollbar appears inside the JSON
       region and you can scroll to the end without the Summary / field strip
       being pushed off-screen.
    5. Click the Raw tab: confirm the same scroll behavior.
    6. Resize the detail panel narrower/wider via the resize handle: scroll
       still works in both tabs.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues.</resume-signal>
</task>

</tasks>

<verification>
- New regression tests in `DetailPanel.test.tsx` pass.
- Existing `DetailPanel.test.tsx` suite remains green.
- `pnpm --filter @ahp-viewer/ui test` passes overall.
- TypeScript: no new errors.
- Manual: scrollbar appears and works in both Pretty and Raw tabs for tall payloads.
</verification>

<success_criteria>
- Right-side response viewer scrolls vertically when content overflows, in both Pretty and Raw tabs.
- Only `DetailPanel.tsx` and `DetailPanel.test.tsx` are modified.
- No styling regressions in unrelated detail-panel regions.
</success_criteria>

<output>
After completion, create `.planning/quick/260508-pj1-in-the-response-viewer-on-the-right-side/SUMMARY.md`
summarizing the change (one-line root cause + the single-line CSS fix + tests added).
</output>
