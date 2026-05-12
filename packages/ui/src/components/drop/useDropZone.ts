// useDropZone — owns the window-level drag listeners and the DropOverlay state machine.
// CONTEXT D-03 (window-level listeners) and D-05 (no new transport — reuses onOpenPath).

import { useCallback, useEffect, useRef, useState } from "react";
import { ERROR_COPY, FALLBACK_ERROR } from "../picker/error-copy.js";
import type { DropOverlayState } from "./DropOverlay.js";
import { parseDroppedUri } from "./parseDroppedUri.js";

const NO_FILE_COPY =
  "That drop didn't include a file path. Try dragging from Finder or VS Code's file tree, or paste a path in the picker below.";
const WRONG_EXT_COPY = "Only .jsonl files are supported. Drop the raw AHP log file.";

export interface UseDropZoneArgs {
  hasActiveLog: boolean;
  onOpenPath: (path: string) => Promise<void>;
}

export interface UseDropZoneResult {
  overlayState: DropOverlayState;
  toast: { basename: string; ignoredCount: number } | null;
  dismissError: () => void;
  dismissToast: () => void;
}

function isCodeError(err: unknown): err is { code: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}

export function useDropZone(args: UseDropZoneArgs): UseDropZoneResult {
  const { hasActiveLog, onOpenPath } = args;
  const [overlayState, setOverlayState] = useState<DropOverlayState>({
    kind: "idle",
  });
  const [toast, setToast] = useState<{ basename: string; ignoredCount: number } | null>(null);

  const depthRef = useRef(0);
  const stateRef = useRef<DropOverlayState>(overlayState);
  stateRef.current = overlayState;
  const hasActiveLogRef = useRef(hasActiveLog);
  hasActiveLogRef.current = hasActiveLog;
  const onOpenPathRef = useRef(onOpenPath);
  onOpenPathRef.current = onOpenPath;

  const dismissError = useCallback((): void => {
    setOverlayState({ kind: "idle" });
  }, []);
  const dismissToast = useCallback((): void => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function carriesFiles(dt: DataTransfer | null): boolean {
      if (dt === null) return false;
      const types = dt.types;
      for (let i = 0; i < types.length; i++) {
        if (types[i] === "Files") return true;
      }
      return false;
    }

    function onDragEnter(event: DragEvent): void {
      if (!carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      depthRef.current += 1;
      if (stateRef.current.kind === "error") return;
      if (stateRef.current.kind === "idle" || stateRef.current.kind === "armed") {
        setOverlayState({ kind: "armed", replacing: hasActiveLogRef.current });
      }
    }

    function onDragOver(event: DragEvent): void {
      if (!carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
    }

    function onDragLeave(event: DragEvent): void {
      depthRef.current = Math.max(0, depthRef.current - 1);
      const atDocumentEdge = event.relatedTarget === null || depthRef.current === 0;
      if (!atDocumentEdge) return;
      depthRef.current = 0;
      if (stateRef.current.kind === "armed") {
        setOverlayState({ kind: "idle" });
      }
    }

    function onDrop(event: DragEvent): void {
      event.preventDefault();
      depthRef.current = 0;
      const dt = event.dataTransfer;
      if (dt === null) {
        setOverlayState({ kind: "error", message: NO_FILE_COPY });
        return;
      }
      const result = parseDroppedUri(dt);
      if (result.kind === "error") {
        const message = result.code === "no-uri" ? NO_FILE_COPY : WRONG_EXT_COPY;
        setOverlayState({ kind: "error", message });
        return;
      }

      const { path, ignoredCount } = result;
      const basename = path.split("/").pop() ?? path;
      setOverlayState({ kind: "idle" });

      void (async () => {
        try {
          await onOpenPathRef.current(path);
          if (ignoredCount > 0) {
            setToast({ basename, ignoredCount });
          }
        } catch (err) {
          const code = isCodeError(err) ? err.code : null;
          const message = (code !== null && ERROR_COPY[code]) || FALLBACK_ERROR;
          setOverlayState({ kind: "error", message });
        }
      })();
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return { overlayState, toast, dismissError, dismissToast };
}
