import {
  type ActionEnvelope,
  ActionType,
  type AnnotationsState,
  type AutomationCatalogState,
  AutomationRunOriginKind,
  type AutomationRunState,
  AutomationRunStatus,
  type ChangesetState,
  ChangesetStatus,
  type ChatState,
  ReconnectResultType,
  type ResourceWatchState,
  type RootState,
  SessionLifecycle,
  type SessionState,
  SessionStatus,
  type Snapshot,
  type StateAction,
  TerminalClaimKind,
  TerminalLifecycleStatus,
  type TerminalState,
} from "@ahp-inspector/protocol";
import type { AhpEvent } from "@ahp-inspector/shared";
import { describe, expect, it } from "vitest";
import { replayToIndex } from "./replay.js";

const ROOT = "agenthost:/root";
const SESSION = "copilot:/session/1";
const CHAT = "ahp-chat:/chat/1";
const TERMINAL = "terminal:/1";

function ev(partial: Partial<AhpEvent> & Pick<AhpEvent, "kind" | "dir" | "seq">): AhpEvent {
  return {
    seq: partial.seq,
    ts: partial.ts ?? partial.seq * 1000,
    tsRaw: partial.tsRaw ?? String(partial.ts ?? partial.seq * 1000),
    dir: partial.dir,
    kind: partial.kind,
    method: partial.method ?? null,
    actionType: partial.actionType ?? null,
    id: partial.id ?? null,
    idType: partial.idType ?? "null",
    sessionId: partial.sessionId ?? null,
    turnId: partial.turnId ?? null,
    toolCallId: partial.toolCallId ?? null,
    serverSeq: partial.serverSeq ?? null,
    byteOffset: partial.byteOffset ?? 0,
    byteLength: partial.byteLength ?? 0,
    raw: partial.raw,
    parse: partial.parse ?? "ok",
    ...(partial.parseError ? { parseError: partial.parseError } : {}),
  };
}

function rootState(overrides: Partial<RootState> = {}): RootState {
  return { agents: [], ...overrides };
}

function sessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    provider: "copilot",
    title: "Session",
    status: SessionStatus.Idle,
    lifecycle: SessionLifecycle.Creating,
    activeClients: [],
    chats: [],
    ...overrides,
  };
}

function chatState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    resource: CHAT,
    title: "Chat",
    status: SessionStatus.Idle,
    modifiedAt: "1970-01-01T00:00:00.000Z",
    turns: [],
    ...overrides,
  };
}

function terminalState(overrides: Partial<TerminalState> = {}): TerminalState {
  return {
    title: "Terminal",
    content: [],
    lifecycle: { status: TerminalLifecycleStatus.Running },
    claim: { kind: TerminalClaimKind.Client, clientId: "client-1" },
    ...overrides,
  };
}

const annotationsState: AnnotationsState = { annotations: [] };
const automationState: AutomationCatalogState = { automations: [] };
const automationRunState: AutomationRunState = {
  resource: "ahp-automation-run:/1",
  automation: "ahp-automation:/1",
  origin: { kind: AutomationRunOriginKind.Manual },
  lifecycle: {
    status: AutomationRunStatus.Pending,
    createdAt: "1970-01-01T00:00:00.000Z",
  },
  sessions: [],
};
const changesetState: ChangesetState = { status: ChangesetStatus.Ready, files: [] };
const resourceWatchState: ResourceWatchState = { root: "file:///workspace", recursive: true };

function request(seq: number, method: string, id = 1, sessionId: string | null = null): AhpEvent {
  return ev({
    seq,
    dir: "c2s",
    kind: "request",
    method,
    id,
    idType: "number",
    sessionId,
    raw: { jsonrpc: "2.0", id, method, params: {} },
  });
}

function response(seq: number, result: unknown, id = 1, sessionId: string | null = null): AhpEvent {
  return ev({
    seq,
    dir: "s2c",
    kind: "response",
    id,
    idType: "number",
    sessionId,
    raw: { jsonrpc: "2.0", id, result },
  });
}

function actionEvent(seq: number, envelope: ActionEnvelope, ts = seq * 1000): AhpEvent {
  return ev({
    seq,
    ts,
    dir: "s2c",
    kind: "action",
    method: "action",
    actionType: envelope.action.type,
    serverSeq: envelope.serverSeq,
    raw: { jsonrpc: "2.0", method: "action", params: envelope },
  });
}

function dispatchIntent(seq: number, clientSeq: number, action: StateAction): AhpEvent {
  const channel = action.type.startsWith("root/")
    ? ROOT
    : action.type.startsWith("chat/")
      ? CHAT
      : action.type.startsWith("terminal/")
        ? TERMINAL
        : SESSION;
  return ev({
    seq,
    dir: "c2s",
    kind: "client-notification",
    method: "dispatchAction",
    actionType: action.type,
    raw: { jsonrpc: "2.0", method: "dispatchAction", params: { channel, clientSeq, action } },
  });
}

function snapshot(resource: string, state: Snapshot["state"], fromSeq = 0): Snapshot {
  return { resource, state, fromSeq };
}

function envelope(
  action: StateAction,
  serverSeq: number,
  origin?: ActionEnvelope["origin"],
): ActionEnvelope {
  const channel = action.type.startsWith("root/")
    ? ROOT
    : action.type.startsWith("chat/")
      ? CHAT
      : action.type.startsWith("terminal/")
        ? TERMINAL
        : SESSION;
  return { channel, action, serverSeq, origin };
}

describe("replayToIndex", () => {
  it("returns diagnostics for invalid target indexes instead of throwing", () => {
    expect(replayToIndex([], 0)).toMatchObject({
      targetIndex: 0,
      resources: [],
      intents: [],
      diagnostics: [{ code: "invalid-target-index" }],
    });
    expect(replayToIndex([], -1).diagnostics[0]?.code).toBe("invalid-target-index");
  });

  it("installs initialize root snapshots", () => {
    const events = [
      request(0, "initialize"),
      response(1, {
        protocolVersion: "0.1.0",
        serverSeq: 0,
        snapshots: [snapshot(ROOT, rootState(), 0)],
      }),
    ];

    const result = replayToIndex(events, 1);

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.key).toEqual({ kind: "root", uri: ROOT });
    expect(result.resources[0]?.confidence).toBe("complete");
  });

  it("installs subscribe session, chat, and terminal snapshots", () => {
    const events = [
      request(0, "subscribe", 1, SESSION),
      response(1, { snapshot: snapshot(SESSION, sessionState(), 0) }, 1, SESSION),
      request(2, "subscribe", 2, CHAT),
      response(3, { snapshot: snapshot(CHAT, chatState(), 0) }, 2, CHAT),
      request(4, "subscribe", 3),
      response(5, { snapshot: snapshot(TERMINAL, terminalState(), 0) }, 3),
    ];

    const result = replayToIndex(events, 5);

    expect(result.resources.map((resource) => resource.key)).toEqual([
      { kind: "session", uri: SESSION },
      { kind: "chat", uri: CHAT },
      { kind: "terminal", uri: TERMINAL },
    ]);
  });

  it("classifies every current reducer-backed channel snapshot", () => {
    const snapshots = [
      snapshot("copilot:/session/1/annotations", annotationsState),
      snapshot("ahp-automations://catalog", automationState),
      snapshot("ahp-automation-run:/1", automationRunState),
      snapshot("copilot:/session/1/changeset/all", changesetState),
      snapshot("ahp-resource-watch:/1", resourceWatchState),
    ];
    const events = [
      request(0, "initialize"),
      response(1, { protocolVersion: "1.0.0", serverSeq: 0, snapshots }),
    ];

    expect(replayToIndex(events, 1).resources.map((resource) => resource.key.kind)).toEqual([
      "annotations",
      "automation",
      "automation-run",
      "changeset",
      "resource-watch",
    ]);
  });

  it("retains unrecognized snapshots with unknown confidence", () => {
    const events = [
      request(0, "subscribe"),
      response(1, {
        snapshot: { resource: "ahp-future:/1", state: { future: true }, fromSeq: 4 },
      }),
    ];

    const result = replayToIndex(events, 1);
    expect(result.resources[0]).toMatchObject({
      key: { kind: "unknown", uri: "ahp-future:/1" },
      state: { future: true },
      confidence: "unknown",
      lastServerSeq: 4,
    });
    expect(result.diagnostics[0]?.code).toBe("unknown-snapshot");
  });

  it("replays historical combined session snapshots without treating them as current state", () => {
    const legacyState = {
      summary: {
        resource: SESSION,
        provider: "copilot",
        title: "Historical session",
        status: SessionStatus.Idle,
        createdAt: 1,
        modifiedAt: 1,
      },
      lifecycle: "creating",
      turns: [],
    };
    const events = [
      request(0, "subscribe", 1, SESSION),
      response(1, { snapshot: { resource: SESSION, state: legacyState, fromSeq: 0 } }, 1, SESSION),
      actionEvent(
        2,
        envelope({ type: ActionType.SessionTitleChanged, title: "Historical rename" }, 1),
        12_345,
      ),
    ];

    const result = replayToIndex(events, 2);
    expect(result.resources[0]).toMatchObject({
      key: { kind: "session", uri: SESSION },
      confidence: "complete",
      state: {
        summary: { title: "Historical rename", modifiedAt: 12_345 },
      },
    });
  });

  it("ignores unpaired responses and diagnoses malformed snapshots", () => {
    const unpaired = replayToIndex(
      [response(0, { snapshot: snapshot(SESSION, sessionState(), 0) })],
      0,
    );
    expect(unpaired.resources).toHaveLength(0);

    const malformed = replayToIndex(
      [request(0, "subscribe"), response(1, { snapshot: { resource: SESSION } })],
      1,
    );
    expect(malformed.resources).toHaveLength(0);
    expect(malformed.diagnostics[0]?.code).toBe("malformed-envelope");
  });

  it("applies root, session, chat, and terminal server envelopes to existing baselines", () => {
    const events = [
      request(0, "initialize"),
      response(1, {
        protocolVersion: "0.1.0",
        serverSeq: 0,
        snapshots: [
          snapshot(ROOT, rootState(), 0),
          snapshot(SESSION, sessionState(), 0),
          snapshot(CHAT, chatState(), 0),
          snapshot(TERMINAL, terminalState(), 0),
        ],
      }),
      actionEvent(
        2,
        envelope(
          {
            type: ActionType.RootAgentsChanged,
            agents: [
              { provider: "copilot", displayName: "Copilot", description: "AI", models: [] },
            ],
          },
          1,
        ),
      ),
      actionEvent(3, envelope({ type: ActionType.SessionReady }, 1)),
      actionEvent(4, envelope({ type: ActionType.ChatActivityChanged, activity: "Thinking" }, 1)),
      actionEvent(5, envelope({ type: ActionType.TerminalData, data: "hello" }, 1)),
    ];

    const result = replayToIndex(events, 5);

    expect((result.resources[0]?.state as RootState).agents).toHaveLength(1);
    expect((result.resources[1]?.state as SessionState).lifecycle).toBe(SessionLifecycle.Ready);
    expect((result.resources[2]?.state as ChatState).activity).toBe("Thinking");
    expect((result.resources[3]?.state as TerminalState).content).toEqual([
      { type: "unclassified", value: "hello" },
    ]);
  });

  it("diagnoses missing baselines and malformed action envelopes", () => {
    const missing = replayToIndex(
      [actionEvent(0, envelope({ type: ActionType.SessionReady }, 1))],
      0,
    );
    expect(missing.diagnostics[0]?.code).toBe("missing-baseline");

    const malformed = replayToIndex(
      [
        ev({
          seq: 0,
          dir: "s2c",
          kind: "action",
          method: "action",
          raw: { jsonrpc: "2.0", method: "action", params: { action: {} } },
        }),
      ],
      0,
    );
    expect(malformed.diagnostics[0]?.code).toBe("malformed-envelope");
  });

  it("replays session metadata without consulting wall-clock time", () => {
    const original = Date.now;
    Date.now = () => 999_999;
    try {
      const result = replayToIndex(
        [
          request(0, "subscribe", 1, SESSION),
          response(1, { snapshot: snapshot(SESSION, sessionState(), 0) }, 1, SESSION),
          actionEvent(
            2,
            envelope({ type: ActionType.SessionTitleChanged, title: "Renamed" }, 1),
            12_345,
          ),
        ],
        2,
      );

      expect((result.resources[0]?.state as SessionState).title).toBe("Renamed");
    } finally {
      Date.now = original;
    }
  });

  it("does not cast future prefixed actions and marks replay confidence unknown", () => {
    const events = [
      request(0, "subscribe", 1, SESSION),
      response(1, { snapshot: snapshot(SESSION, sessionState(), 0) }, 1, SESSION),
      actionEvent(
        2,
        envelope({ type: "session/notReal", session: SESSION } as unknown as StateAction, 1),
      ),
    ];

    const first = replayToIndex(events, 2);
    const second = replayToIndex(events, 2);

    expect(first).toEqual(second);
    expect(first.diagnostics.some((diagnostic) => diagnostic.code === "unknown-action")).toBe(true);
    expect(first.resources[0]?.confidence).toBe("unknown");
    expect((first.resources[0]?.state as SessionState).title).toBe("Session");
  });

  it("diagnoses serverSeq gaps while still applying later canonical envelopes", () => {
    const result = replayToIndex(
      [
        request(0, "initialize"),
        response(1, {
          protocolVersion: "0.1.0",
          serverSeq: 0,
          snapshots: [snapshot(ROOT, rootState(), 0)],
        }),
        actionEvent(
          2,
          envelope({ type: ActionType.RootActiveSessionsChanged, activeSessions: 5 }, 2),
        ),
      ],
      2,
    );

    expect(result.diagnostics[0]?.code).toBe("server-seq-gap");
    expect((result.resources[0]?.state as RootState).activeSessions).toBe(5);
    expect(result.resources[0]?.confidence).toBe("partial");
  });

  it("skips duplicate and out-of-order serverSeq envelopes", () => {
    const duplicate = replayToIndex(
      [
        request(0, "subscribe", 1),
        response(1, { snapshot: snapshot(TERMINAL, terminalState(), 0) }, 1),
        actionEvent(2, envelope({ type: ActionType.TerminalData, data: "a" }, 1)),
        actionEvent(3, envelope({ type: ActionType.TerminalData, data: "b" }, 1)),
      ],
      3,
    );
    expect(
      duplicate.diagnostics.some((diagnostic) => diagnostic.code === "server-seq-duplicate"),
    ).toBe(true);
    expect((duplicate.resources[0]?.state as TerminalState).content).toEqual([
      { type: "unclassified", value: "a" },
    ]);

    const outOfOrder = replayToIndex(
      [
        request(0, "subscribe", 1),
        response(1, { snapshot: snapshot(TERMINAL, terminalState(), 0) }, 1),
        actionEvent(2, envelope({ type: ActionType.TerminalData, data: "a" }, 2)),
        actionEvent(3, envelope({ type: ActionType.TerminalData, data: "b" }, 1)),
      ],
      3,
    );
    expect(
      outOfOrder.diagnostics.some((diagnostic) => diagnostic.code === "server-seq-out-of-order"),
    ).toBe(true);
    expect((outOfOrder.resources[0]?.state as TerminalState).content).toEqual([
      { type: "unclassified", value: "a" },
    ]);
  });

  it("applies reconnect replay actions in order with the reconnect response timestamp", () => {
    const events = [
      request(0, "subscribe", 1, SESSION),
      response(1, { snapshot: snapshot(SESSION, sessionState(), 0) }, 1, SESSION),
      request(2, "reconnect", 2),
      response(
        3,
        {
          type: ReconnectResultType.Replay,
          actions: [
            envelope({ type: ActionType.SessionTitleChanged, title: "First" }, 1),
            envelope({ type: ActionType.SessionTitleChanged, title: "Second" }, 2),
          ],
          missing: ["copilot:/gone"],
        },
        2,
        null,
      ),
    ];

    const result = replayToIndex(events, 3);

    expect((result.resources[0]?.state as SessionState).title).toBe("Second");
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "reconnect-missing-resource"),
    ).toBe(true);
  });

  it("installs reconnect snapshot responses as fresh baselines", () => {
    const events = [
      request(0, "initialize"),
      response(1, {
        protocolVersion: "0.1.0",
        serverSeq: 0,
        snapshots: [snapshot(ROOT, rootState({ activeSessions: 1 }), 0)],
      }),
      request(2, "reconnect", 2),
      response(
        3,
        {
          type: ReconnectResultType.Snapshot,
          snapshots: [snapshot(ROOT, rootState({ activeSessions: 7 }), 10)],
        },
        2,
      ),
    ];

    const result = replayToIndex(events, 3);

    expect((result.resources[0]?.state as RootState).activeSessions).toBe(7);
    expect(result.resources[0]).toMatchObject({
      baselineEventIdx: 3,
      lastAppliedEventIdx: 3,
      baselineFromSeq: 10,
      lastServerSeq: 10,
    });
  });

  it("continues after malformed reconnect replay entries", () => {
    const events = [
      request(0, "initialize"),
      response(1, {
        protocolVersion: "0.1.0",
        serverSeq: 0,
        snapshots: [snapshot(ROOT, rootState(), 0)],
      }),
      request(2, "reconnect", 2),
      response(
        3,
        {
          type: ReconnectResultType.Replay,
          actions: [
            { serverSeq: "bad", action: {} },
            envelope({ type: ActionType.RootActiveSessionsChanged, activeSessions: 3 }, 1),
          ],
          missing: [],
        },
        2,
      ),
    ];

    const result = replayToIndex(events, 3);

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "malformed-envelope")).toBe(
      true,
    );
    expect((result.resources[0]?.state as RootState).activeSessions).toBe(3);
  });

  it("captures client dispatchAction intent without mutating until a server envelope accepts it", () => {
    const clientAction: StateAction = {
      type: ActionType.SessionTitleChanged,
      title: "Client title",
    };
    const baseline = [
      request(0, "subscribe", 1, SESSION),
      response(1, { snapshot: snapshot(SESSION, sessionState(), 0) }, 1, SESSION),
      dispatchIntent(2, 99, clientAction),
    ];

    const beforeServer = replayToIndex(baseline, 2);
    expect(beforeServer.intents).toMatchObject([
      {
        clientSeq: 99,
        actionType: ActionType.SessionTitleChanged,
        resource: { kind: "session", uri: SESSION },
        ignored: true,
      },
    ]);
    expect(
      beforeServer.diagnostics.some((diagnostic) => diagnostic.code === "ignored-client-intent"),
    ).toBe(true);
    expect((beforeServer.resources[0]?.state as SessionState).title).toBe("Session");

    const afterServer = replayToIndex(
      [
        ...baseline,
        actionEvent(3, envelope(clientAction, 1, { clientId: "client-1", clientSeq: 99 })),
      ],
      3,
    );
    expect((afterServer.resources[0]?.state as SessionState).title).toBe("Client title");
    expect(afterServer.intents[0]?.acceptedByServerSeq).toBe(1);
  });

  it("records malformed dispatchAction params and infers root/session/terminal intent resources", () => {
    const events = [
      dispatchIntent(0, 1, { type: ActionType.RootActiveSessionsChanged, activeSessions: 1 }),
      dispatchIntent(1, 2, { type: ActionType.SessionTitleChanged, title: "s" }),
      dispatchIntent(2, 3, {
        type: ActionType.TerminalResized,
        cols: 80,
        rows: 24,
      }),
      ev({
        seq: 3,
        dir: "c2s",
        kind: "client-notification",
        method: "dispatchAction",
        raw: { jsonrpc: "2.0", method: "dispatchAction", params: { clientSeq: "bad" } },
      }),
    ];

    const result = replayToIndex(events, 3);

    expect(result.intents.map((intent) => intent.resource?.kind ?? null)).toEqual([
      "root",
      "session",
      "terminal",
      null,
    ]);
    expect(result.intents[3]).toMatchObject({
      clientSeq: null,
      actionType: null,
      resource: null,
      ignored: true,
    });
  });
});
