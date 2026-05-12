import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDropZone } from "./useDropZone.js";

afterEach(() => cleanup());

interface FakeDataTransfer {
  types: readonly string[];
  getData: (mime: string) => string;
}

function makeDt(uriList: string | null): FakeDataTransfer {
  return {
    types: uriList === null ? [] : ["Files"],
    getData: (mime: string) => (mime === "text/uri-list" && uriList !== null ? uriList : ""),
  };
}

function fireDrag(
  type: "dragenter" | "dragover" | "dragleave" | "drop",
  dt: FakeDataTransfer | null,
  relatedTarget: EventTarget | null = null,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: dt,
    configurable: true,
  });
  Object.defineProperty(event, "relatedTarget", {
    value: relatedTarget,
    configurable: true,
  });
  act(() => {
    window.dispatchEvent(event);
  });
}

interface HarnessProps {
  hasActiveLog: boolean;
  onOpenPath: (p: string) => Promise<void>;
}

function Harness(props: HarnessProps): JSX.Element {
  const { overlayState, toast, dismissError } = useDropZone(props);
  return (
    <div
      data-testid="harness"
      data-overlay-kind={overlayState.kind}
      data-overlay-replacing={overlayState.kind === "armed" ? String(overlayState.replacing) : ""}
      data-overlay-message={overlayState.kind === "error" ? overlayState.message : ""}
      data-toast-basename={toast?.basename ?? ""}
      data-toast-ignored={toast ? String(toast.ignoredCount) : ""}
    >
      <button type="button" data-testid="dismiss" onClick={dismissError}>
        dismiss
      </button>
    </div>
  );
}

const NO_FILE_COPY =
  "That drop didn't include a file path. Try dragging from Finder or VS Code's file tree, or paste a path in the picker below.";
const WRONG_EXT_COPY = "Only .jsonl files are supported. Drop the raw AHP log file.";

describe("useDropZone", () => {
  it("enters armed state on dragenter when no log is active", () => {
    const onOpenPath = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(<Harness hasActiveLog={false} onOpenPath={onOpenPath} />);
    fireDrag("dragenter", makeDt(""));
    const el = getByTestId("harness");
    expect(el.dataset.overlayKind).toBe("armed");
    expect(el.dataset.overlayReplacing).toBe("false");
  });

  it("enters armed-replacing state when a log is active", () => {
    const { getByTestId } = render(
      <Harness hasActiveLog onOpenPath={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireDrag("dragenter", makeDt(""));
    expect(getByTestId("harness").dataset.overlayReplacing).toBe("true");
  });

  it("leaves to idle on dragleave at the document edge", () => {
    const { getByTestId } = render(
      <Harness hasActiveLog={false} onOpenPath={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireDrag("dragenter", makeDt(""));
    fireDrag("dragleave", makeDt(""), null);
    expect(getByTestId("harness").dataset.overlayKind).toBe("idle");
  });

  it("successful drop calls onOpenPath and returns to idle", async () => {
    const onOpenPath = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(<Harness hasActiveLog={false} onOpenPath={onOpenPath} />);
    fireDrag("drop", makeDt("file:///tmp/x.jsonl"));
    await waitFor(() => {
      expect(onOpenPath).toHaveBeenCalledWith("/tmp/x.jsonl");
    });
    expect(getByTestId("harness").dataset.overlayKind).toBe("idle");
  });

  it("multi-file drop sets the toast with basename only", async () => {
    const onOpenPath = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(<Harness hasActiveLog={false} onOpenPath={onOpenPath} />);
    fireDrag("drop", makeDt("file:///tmp/a.png\nfile:///tmp/b.txt\nfile:///tmp/log.jsonl"));
    await waitFor(() => {
      expect(getByTestId("harness").dataset.toastBasename).toBe("log.jsonl");
    });
    const el = getByTestId("harness");
    expect(el.dataset.toastIgnored).toBe("2");
    expect(el.dataset.toastBasename).not.toContain("/tmp");
  });

  it("drop with no usable URI sets the locked NO_FILE_COPY error", () => {
    const { getByTestId } = render(
      <Harness hasActiveLog={false} onOpenPath={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireDrag("drop", makeDt(""));
    expect(getByTestId("harness").dataset.overlayMessage).toBe(NO_FILE_COPY);
  });

  it("drop with only non-jsonl URIs sets the locked WRONG_EXT_COPY error", () => {
    const { getByTestId } = render(
      <Harness hasActiveLog={false} onOpenPath={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireDrag("drop", makeDt("file:///tmp/a.png"));
    expect(getByTestId("harness").dataset.overlayMessage).toBe(WRONG_EXT_COPY);
  });

  it("server error maps via ERROR_COPY without echoing the path", async () => {
    const err = Object.assign(new Error("x"), { code: "not-found" });
    const onOpenPath = vi.fn().mockRejectedValue(err);
    const { getByTestId } = render(<Harness hasActiveLog={false} onOpenPath={onOpenPath} />);
    fireDrag("drop", makeDt("file:///tmp/secret-name.jsonl"));
    await waitFor(() => {
      expect(getByTestId("harness").dataset.overlayMessage).toBe(
        "File not found. Check the path and try again.",
      );
    });
    const msg = getByTestId("harness").dataset.overlayMessage ?? "";
    expect(msg).not.toContain("secret-name");
    expect(msg).not.toContain("/tmp");
  });

  it("dismissError returns to idle from error", () => {
    const { getByTestId } = render(
      <Harness hasActiveLog={false} onOpenPath={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireDrag("drop", makeDt(""));
    expect(getByTestId("harness").dataset.overlayKind).toBe("error");
    act(() => {
      getByTestId("dismiss").click();
    });
    expect(getByTestId("harness").dataset.overlayKind).toBe("idle");
  });

  it("unmount removes the window listeners", () => {
    const onOpenPath = vi.fn();
    const { unmount } = render(<Harness hasActiveLog={false} onOpenPath={onOpenPath} />);
    unmount();
    fireDrag("drop", makeDt("file:///tmp/x.jsonl"));
    expect(onOpenPath).not.toHaveBeenCalled();
  });
});
