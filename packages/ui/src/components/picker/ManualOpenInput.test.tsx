import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualOpenInput } from "./ManualOpenInput.js";

afterEach(() => cleanup());

describe("ManualOpenInput", () => {
  it("calls onOpen with the typed path on submit", async () => {
    const onOpen = vi.fn().mockResolvedValue(undefined);
    render(<ManualOpenInput onOpen={onOpen} />);
    const input = screen.getByPlaceholderText(/absolute\/path/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/tmp/log.jsonl" } });
    fireEvent.click(screen.getByRole("button", { name: /Open Log/i }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith("/tmp/log.jsonl"));
  });

  it("submits on Enter inside the input", async () => {
    const onOpen = vi.fn().mockResolvedValue(undefined);
    render(<ManualOpenInput onOpen={onOpen} />);
    const input = screen.getByPlaceholderText(/absolute\/path/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/tmp/x.jsonl" } });
    const form = input.closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
  });

  it("rejects paths > 4096 chars without calling onOpen", async () => {
    const onOpen = vi.fn();
    render(<ManualOpenInput onOpen={onOpen} />);
    const input = screen.getByPlaceholderText(/absolute\/path/i) as HTMLInputElement;
    // Bypass maxLength via direct value mutation (simulate paste-bypass).
    input.removeAttribute("maxLength");
    fireEvent.change(input, { target: { value: `/${"a".repeat(5000)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Open Log/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Path is too long.");
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("maps server error code → fixed copy without echoing the typed path", async () => {
    const typed = "/tmp/secret-file-name-12345.jsonl";
    const onOpen = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("err"), { code: "not-found" }));
    render(<ManualOpenInput onOpen={onOpen} />);
    const input = screen.getByPlaceholderText(/absolute\/path/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: typed } });
    fireEvent.click(screen.getByRole("button", { name: /Open Log/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("File not found. Check the path and try again.");
    expect(alert.textContent).not.toContain(typed);
    expect(alert.textContent).not.toContain("secret-file-name-12345");
  });

  it("falls back to generic copy on unknown error code", async () => {
    const onOpen = vi.fn().mockRejectedValue(Object.assign(new Error("?"), { code: "weird-code" }));
    render(<ManualOpenInput onOpen={onOpen} />);
    fireEvent.change(screen.getByPlaceholderText(/absolute\/path/i), {
      target: { value: "/tmp/x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Open Log/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Could not open that file. Check that it exists and is readable.",
    );
  });
});
