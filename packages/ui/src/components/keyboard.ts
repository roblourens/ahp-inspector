export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;

  const contentEditable = target.closest("[contenteditable]");
  if (contentEditable) {
    return contentEditable.getAttribute("contenteditable")?.toLowerCase() !== "false";
  }

  return target instanceof HTMLElement && target.isContentEditable;
}
