export type FailureKind = "outline" | "content" | "image" | "export" | "svg";
export type RecoveryAction = "retry" | "stop";

const MAX_RETRY = 2;

export function decideRecovery(
  _kind: FailureKind,
  attempt: number,
  _err?: unknown,
): RecoveryAction {
  if (attempt >= MAX_RETRY) return "stop";
  return "retry";
}
