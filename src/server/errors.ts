/** Expected, user-facing errors. Anything else is treated as a 500 and never shown verbatim. */
export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}
export const notFound = (what = "Record") => new AppError("NOT_FOUND", `${what} not found`, 404);
export const forbidden = (msg = "You do not have permission to do that") => new AppError("FORBIDDEN", msg, 403);

export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function toActionError(e: unknown): ActionResult<never> {
  if (e instanceof AppError) return { ok: false, error: e.message };
  if (e && typeof e === "object" && "issues" in e) {
    const issues = (e as { issues: { path: (string | number)[]; message: string }[] }).issues;
    const fieldErrors: Record<string, string[]> = {};
    for (const i of issues) (fieldErrors[i.path.join(".") || "_"] ??= []).push(i.message);
    return { ok: false, error: issues[0]?.message ?? "Invalid input", fieldErrors };
  }
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}
