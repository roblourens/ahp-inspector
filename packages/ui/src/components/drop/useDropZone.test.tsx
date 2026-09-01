import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDropZone } from "./useDropZone.js";

afterEach(() => cleanup());

interface FakeDataTransfer {
  types: readonly string[];
  getData: (mime: string) => string;
  files: FileList;
}

function makeFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
  } as unknown as FileList;
  for (let i = 0; i < files.length; i++) {
    (list as unknown as Record<number, File>)[i] = files[i] as File;
  }
  return list;
}

function makeDt(uriList: string | null, files: File[] = []): FakeDataTransfer {
  const types: string[] = [];
  if (uriList !== null || files.length > 0) types.push("Files");
  return {
    types,
    getData: (mime: string) => (mime === "text/uri-list" && uriList !== null ? uriList : ""),
    files: makeFileList(files),
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
  onUploadFile?: (file: File) => Promise<void>;
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

  it("falls back to onUploadFile when no URI but a .jsonl File is present", async () => {
    const onOpenPath = vi.fn().mockResolvedValue(undefined);
    const onUploadFile = vi.fn().mockResolvedValue(undefined);
    const file = new File(["{}\n"], "finder-drag.jsonl", { type: "" });
    render(<Harness hasActiveLog={false} onOpenPath={onOpenPath} onUploadFile={onUploadFile} />);
    fireDrag("drop", makeDt(null, [file]));
    await waitFor(() => {
      expect(onUploadFile).toHaveBeenCalledTimes(1);
    });
    expect(onUploadFile.mock.calls[0]?.[0]).toBe(file);
    expect(onOpenPath).not.toHaveBeenCalled();
  });

  it("upload fallback: multiple jsonl files set toast with first as basename", async () => {
    const onUploadFile = vi.fn().mockResolvedValue(undefined);
    const a = new File(["{}\n"], "a.jsonl");
    const b = new File(["{}\n"], "b.jsonl");
    const { getByTestId } = render(
      <Harness
        hasActiveLog={false}
        onOpenPath={vi.fn().mockResolvedValue(undefined)}
        onUploadFile={onUploadFile}
      />,
    );
    fireDrag("drop", makeDt(null, [a, b]));
    await waitFor(() => {
      expect(getByTestId("harness").dataset.toastBasename).toBe("a.jsonl");
    });
    expect(getByTestId("harness").dataset.toastIgnored).toBe("1");
  });

  it("upload fallback: no .jsonl Files surfaces NO_FILE_COPY error", () => {
    const onUploadFile = vi.fn();
    const png = new File([""], "image.png");
    const { getByTestId } = render(
      <Harness
        hasActiveLog={false}
        onOpenPath={vi.fn().mockResolvedValue(undefined)}
        onUploadFile={onUploadFile}
      />,
    );
    fireDrag("drop", makeDt(null, [png]));
    expect(onUploadFile).not.toHaveBeenCalled();
    expect(getByTestId("harness").dataset.overlayMessage).toBe(NO_FILE_COPY);
  });

  it("upload fallback: too-large error shows the size message", async () => {
    const err = Object.assign(new Error("x"), { code: "too-large" });
    const onUploadFile = vi.fn().mockRejectedValue(err);
    const file = new File(["{}\n"], "big.jsonl");
    const { getByTestId } = render(
      <Harness
        hasActiveLog={false}
        onOpenPath={vi.fn().mockResolvedValue(undefined)}
        onUploadFile={onUploadFile}
      />,
    );
    fireDrag("drop", makeDt(null, [file]));
    await waitFor(() => {
      const msg = getByTestId("harness").dataset.overlayMessage ?? "";
      expect(msg).toContain("too large");
    });
  });
});
