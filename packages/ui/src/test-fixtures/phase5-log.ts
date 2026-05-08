export const PHASE5_BASE_JSONL =
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"sessionId":"session-alpha","clientInfo":{"name":"safe-fixture"}}}\n{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"tools":true},"sessionId":"session-alpha"}}\n{"jsonrpc":"2.0","method":"action","params":{"actionType":"tool_call.started","sessionId":"session-alpha","turnId":"turn-001","toolCallId":"tool-abc","title":"Run scrubbed diagnostic"}}\n{"jsonrpc":"2.0","method":"notification","params":{"type":"authRequired","sessionId":"session-alpha","message":"Authentication required for synthetic provider"}}\n{"jsonrpc":"2.0","id":"long-action-42","method":"workspace/executeCommand","params":{"sessionId":"session-beta","turnId":"turn-002","command":"very.long.synthetic.action.identifier.for.phase.five.testing","query":"retrowave search needle"}}\n{"jsonrpc":"2.0","id":"long-action-42","error":{"code":-32001,"message":"Synthetic command failed safely"}}\n{"jsonrpc":"2.0","method":"action","params":{"actionType":"tool_call.completed","sessionId":"session-alpha","turnId":"turn-001","toolCallId":"tool-abc","summary":"phase five appended baseline"}}\n{ malformed phase5 json\n';

export const PHASE5_APPENDED_EVENT =
  '{"jsonrpc":"2.0","method":"notification","params":{"type":"phase5.appended","sessionId":"session-alpha","message":"append sentinel"}}';

export function phase5FixtureLines(): string[] {
  return PHASE5_BASE_JSONL.trimEnd().split("\n");
}
