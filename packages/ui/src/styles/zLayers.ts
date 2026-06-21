/**
 * Z-index layer scale for inline styles.
 *
 * React's `CSSProperties.zIndex` type does not accept `var(--z-*)` strings, so
 * components that set z-index inline reference these numeric constants instead.
 * They MUST mirror the `--z-*` custom properties in
 * {@link ../../styles/tokens.css} — `zLayers.test.ts` fails if they drift.
 *
 * Order (low → high). The decorative CRT overlay sits below all interactive
 * chrome so it can never occlude controls, dialogs, or the drawer.
 */
export const Z = {
  base: 0,
  app: 1,
  crtOverlay: 5,
  sticky: 100,
  controls: 1000,
  popover: 1100,
  header: 1200,
  picker: 1250,
  toast: 1400,
  drawerBackdrop: 2000,
  drawer: 2010,
  dialog: 2100,
} as const;

/** Maps each {@link Z} key to its `--z-*` custom property name in tokens.css. */
export const Z_CSS_VAR: Record<keyof typeof Z, string> = {
  base: "--z-base",
  app: "--z-app",
  crtOverlay: "--z-crt-overlay",
  sticky: "--z-sticky",
  controls: "--z-controls",
  popover: "--z-popover",
  header: "--z-header",
  picker: "--z-picker",
  toast: "--z-toast",
  drawerBackdrop: "--z-drawer-backdrop",
  drawer: "--z-drawer",
  dialog: "--z-dialog",
};
