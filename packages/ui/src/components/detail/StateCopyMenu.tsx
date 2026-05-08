import { ChevronDown } from "lucide-react";
import { type JSX, useEffect, useRef, useState } from "react";
import type { StateAtSelectedResource } from "../../transport/state-client.js";
import { copyText } from "./clipboard.js";

interface StateCopyMenuProps {
  readonly targetIndex: number;
  readonly resource: StateAtSelectedResource;
  readonly onCopy: (message: string, ok: boolean) => void;
}

export function StateCopyMenu({ targetIndex, resource, onCopy }: StateCopyMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleCopy(getContent: () => string) {
    setOpen(false);
    const text = getContent();
    try {
      await copyText(text);
      onCopy(`Copied ${text.length} chars`, true);
    } catch {
      onCopy("Copy failed. Select and copy manually.", false);
    }
  }

  const menuItems = [
    { label: "Copy state raw JSON", action: () => stringifyState(resource.state) },
    { label: "Copy state pretty JSON", action: () => stringifyState(resource.state, 2) },
    { label: "Copy state summary", action: () => buildStateSummary(targetIndex, resource) },
  ];

  return (
    <div ref={menuRef} className="state-copy-menu">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="state-copy-button"
      >
        Copy state <ChevronDown size={12} />
      </button>
      {open && (
        <div role="menu" className="state-copy-menu-list">
          {menuItems.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => handleCopy(item.action)}
              className="state-copy-menu-item"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function stringifyState(state: unknown, space?: number): string {
  try {
    return JSON.stringify(state, null, space);
  } catch {
    return "[Circular or non-serializable value]";
  }
}

function buildStateSummary(targetIndex: number, resource: StateAtSelectedResource): string {
  return [
    `target=#${targetIndex}`,
    `resource=${resource.kind} ${resource.uri}`,
    `confidence=${resource.confidence}`,
    `diagnostics=${resource.diagnostics.length}`,
    `baselineEvent=#${resource.baselineEventIdx}`,
    `lastAppliedEvent=#${resource.lastAppliedEventIdx}`,
    `baselineSeq=${resource.baselineFromSeq ?? "—"}`,
    `lastServerSeq=${resource.lastServerSeq ?? "—"}`,
  ].join("\n");
}
