export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION"
  | "AI_LIMIT"
  | "AI_FAILED"
  | "NOT_RECEIPT"
  | "NOT_FOUND"
  | "CONFLICT";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string };
