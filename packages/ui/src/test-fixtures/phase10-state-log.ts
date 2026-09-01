const ROOT = "agenthost:/root";
const SESSION = "copilot:/session/1";
const CHAT = "ahp-chat:/chat/1";
const TERMINAL = "terminal:/1";

function jsonl(raw: unknown): string {
  return JSON.stringify(raw);
}

function rootSnapshotState(activeSessions = 1): Record<string, unknown> {
  return { agents: [], activeSessions };
}

function sessionSnapshotState(title = "Phase 10 baseline"): Record<string, unknown> {
  return {
    provider: "copilot",
    title,
    status: 1,
    lifecycle: "creating",
    activeClients: [],
    chats: [
      {
        resource: CHAT,
        title: "Phase 10 chat",
        status: 1,
        modifiedAt: "1970-01-01T00:00:00.001Z",
      },
    ],
    defaultChat: CHAT,
  };
}

function chatSnapshotState(): Record<string, unknown> {
  return {
    resource: CHAT,
    title: "Phase 10 chat",
    status: 1,
    modifiedAt: "1970-01-01T00:00:00.001Z",
    turns: [],
  };
}

function terminalSnapshotState(): Record<string, unknown> {
  return {
    title: "Phase 10 terminal",
    content: [],
    claim: { kind: "client", clientId: "phase10-client" },
  };
}

export function phase10StateLogLines(extraPingCount = 0): string[] {
  const lines: string[] = [
    jsonl({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { clientInfo: { name: "phase10-synthetic" } },
    }),
    jsonl({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "0.1.0",
        serverSeq: 0,
        snapshots: [
          { resource: ROOT, fromSeq: 0, state: rootSnapshotState() },
          { resource: SESSION, fromSeq: 0, state: sessionSnapshotState() },
          { resource: CHAT, fromSeq: 0, state: chatSnapshotState() },
          { resource: TERMINAL, fromSeq: 0, state: terminalSnapshotState() },
        ],
      },
    }),
    jsonl({
      jsonrpc: "2.0",
      method: "action",
      params: {
        channel: CHAT,
        serverSeq: 1,
        action: { type: "mystery.action", detail: "diagnostic sentinel" },
      },
    }),
    jsonl({
      jsonrpc: "2.0",
      method: "action",
      params: {
        channel: SESSION,
        serverSeq: 2,
        action: {
          type: "session/titleChanged",
          title: "Phase 10 title after action",
        },
      },
    }),
    jsonl({
      jsonrpc: "2.0",
      method: "action",
      params: {
        channel: ROOT,
        serverSeq: 3,
        action: { type: "root/activeSessionsChanged", activeSessions: 2 },
      },
    }),
  ];

  for (let i = 0; i < extraPingCount; i++) {
    lines.push(
      jsonl({
        jsonrpc: "2.0",
        id: i + 100,
        method: "phase10/ping",
        params: { i, sessionId: "phase10-synthetic" },
      }),
    );
  }

  return lines;
}

export const PHASE10_STATE_JSONL = `${phase10StateLogLines().join("\n")}\n`;
