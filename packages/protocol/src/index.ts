export * from "./action-origin.generated.js";
export * from "./actions.js";
export * from "./commands.js";
export * from "./errors.js";
export * from "./messages.js";
export * from "./notifications.js";
export * from "./reducers.js";
export * from "./source-info.js";
export * from "./state.js";
export * from "./version/registry.js";

import type { SessionSummary, URI } from "./state.js";
import type { AuthRequiredReason } from "./notifications.js";

export const enum NotificationType {
	SessionAdded = "notify/sessionAdded",
	SessionRemoved = "notify/sessionRemoved",
	SessionSummaryChanged = "notify/sessionSummaryChanged",
	AuthRequired = "notify/authRequired",
}

export type ProtocolNotification =
	| { readonly type: NotificationType.SessionAdded; readonly summary: SessionSummary }
	| { readonly type: NotificationType.SessionRemoved; readonly session: URI }
	| {
			readonly type: NotificationType.SessionSummaryChanged;
			readonly session: URI;
			readonly changes: Partial<SessionSummary>;
		}
	| {
			readonly type: NotificationType.AuthRequired;
			readonly resource: string;
			readonly reason?: AuthRequiredReason;
		};

export interface NotificationMap {
	readonly [NotificationType.SessionAdded]: Extract<
		ProtocolNotification,
		{ readonly type: NotificationType.SessionAdded }
	>;
	readonly [NotificationType.SessionRemoved]: Extract<
		ProtocolNotification,
		{ readonly type: NotificationType.SessionRemoved }
	>;
	readonly [NotificationType.SessionSummaryChanged]: Extract<
		ProtocolNotification,
		{ readonly type: NotificationType.SessionSummaryChanged }
	>;
	readonly [NotificationType.AuthRequired]: Extract<
		ProtocolNotification,
		{ readonly type: NotificationType.AuthRequired }
	>;
}
