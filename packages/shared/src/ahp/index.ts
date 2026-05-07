// Re-export AHP types verbatim from the sibling repo. Do NOT redefine.
// FOUND-03: locked re-export surface so every later phase consumes identical types.
//
// The `agent-host-protocol` package has no `exports` map, so we import the
// canonical barrel directly via subpath. With moduleResolution: "bundler"
// TypeScript resolves the `.js` extension to the corresponding `.ts` file.

// `ActionType` and `NotificationType` are upstream `const enum`s. Under
// `isolatedModules` + `verbatimModuleSyntax` we can only re-export them as
// types; consumers that need a string-literal value should narrow against the
// re-exported type rather than reading runtime members. (RESEARCH §"Sources".)
export type { ActionType, IActionEnvelope } from "agent-host-protocol/types/actions.js";
export type {
  IAhpClientNotification,
  IAhpNotification,
  IAhpRequest,
  IAhpResponse,
  IAhpServerNotification,
  IAhpSuccessResponse,
  IClientNotificationMap,
  ICommandMap,
  IJsonRpcErrorResponse,
  IJsonRpcNotification,
  IJsonRpcRequest,
  IJsonRpcResponse,
  IJsonRpcSuccessResponse,
  INotificationMap,
  IProtocolMessage,
  IServerNotificationMap,
} from "agent-host-protocol/types/messages.js";
export type {
  AuthRequiredReason,
  IProtocolNotification,
  NotificationType,
} from "agent-host-protocol/types/notifications.js";
