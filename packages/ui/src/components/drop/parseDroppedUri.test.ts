import { describe, expect, it } from "vitest";
import { parseDroppedUri } from "./parseDroppedUri.js";

const dt = (uriList: string): Pick<DataTransfer, "getData"> => ({
  getData: (mime: string) => (mime === "text/uri-list" ? uriList : ""),
});

describe("parseDroppedUri", () => {
  it("returns ok with decoded path for a single file:// .jsonl URI", () => {
    expect(parseDroppedUri(dt("file:///Users/me/log.jsonl"))).toEqual({
      kind: "ok",
      path: "/Users/me/log.jsonl",
      ignoredCount: 0,
    });
  });

  it("decodes percent-encoded characters (spaces, UTF-8)", () => {
    const result = parseDroppedUri(dt("file:///tmp/with%20space/r%C3%A9sum%C3%A9.jsonl"));
    expect(result).toEqual({
      kind: "ok",
      path: "/tmp/with space/résumé.jsonl",
      ignoredCount: 0,
    });
  });

  it("accepts uppercase .JSONL extension", () => {
    const result = parseDroppedUri(dt("file:///tmp/x.JSONL"));
    expect(result.kind).toBe("ok");
  });

  it("picks the first .jsonl when multiple URIs are present, counting only rejected entries", () => {
    const r1 = parseDroppedUri(dt("file:///tmp/a.png\r\nfile:///tmp/b.txt\r\nfile:///tmp/c.jsonl"));
    expect(r1).toEqual({
      kind: "ok",
      path: "/tmp/c.jsonl",
      ignoredCount: 2,
    });

    const r2 = parseDroppedUri(dt("file:///tmp/a.jsonl\r\nfile:///tmp/b.png"));
    expect(r2).toEqual({
      kind: "ok",
      path: "/tmp/a.jsonl",
      ignoredCount: 0,
    });
  });

  it("ignores RFC 2483 comment lines (leading #) and blank lines without counting them", () => {
    const result = parseDroppedUri(dt("# from finder\n\nfile:///tmp/x.jsonl\n"));
    expect(result).toEqual({
      kind: "ok",
      path: "/tmp/x.jsonl",
      ignoredCount: 0,
    });
  });

  it("returns no-uri when text/uri-list is empty", () => {
    expect(parseDroppedUri(dt(""))).toEqual({ kind: "error", code: "no-uri" });
  });

  it("returns no-uri when text/uri-list contains only comments", () => {
    expect(parseDroppedUri(dt("# nothing\n# else\n"))).toEqual({
      kind: "error",
      code: "no-uri",
    });
  });

  it("returns not-jsonl when only non-.jsonl URIs are present", () => {
    expect(parseDroppedUri(dt("file:///tmp/a.png\nfile:///tmp/b.txt\n"))).toEqual({
      kind: "error",
      code: "not-jsonl",
    });
  });

  it("treats non-file protocols as ignored entries", () => {
    expect(parseDroppedUri(dt("https://localhost/x.jsonl\nfile:///tmp/y.jsonl"))).toEqual({
      kind: "ok",
      path: "/tmp/y.jsonl",
      ignoredCount: 1,
    });
  });

  it("treats unparseable URI strings as ignored entries", () => {
    expect(parseDroppedUri(dt("not a url\nfile:///tmp/y.jsonl"))).toEqual({
      kind: "ok",
      path: "/tmp/y.jsonl",
      ignoredCount: 1,
    });
  });

  it("returns not-jsonl when only non-file protocols are present", () => {
    expect(parseDroppedUri(dt("https://localhost/x.jsonl\n"))).toEqual({
      kind: "error",
      code: "not-jsonl",
    });
  });

  it("treats malformed percent-encoding as an ignored entry instead of throwing", () => {
    expect(parseDroppedUri(dt("file:///tmp/%E0%A4%A.jsonl\nfile:///tmp/y.jsonl"))).toEqual({
      kind: "ok",
      path: "/tmp/y.jsonl",
      ignoredCount: 1,
    });
  });
});
