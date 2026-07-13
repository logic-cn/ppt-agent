export type FailureKind = "outline" | "content" | "image" | "export";
export type RecoveryAction = "retry" | "degrade-rulebased" | "ask-user";

const MAX_RETRY = 2;

export function decideRecovery(
  kind: FailureKind,
  attempt: number,
  _err?: unknown,
): RecoveryAction {
  if (kind === "image")
    return attempt < MAX_RETRY ? "retry" : "degrade-rulebased";
  if (attempt >= MAX_RETRY) return "ask-user";
  return "retry";
}
