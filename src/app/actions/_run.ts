import { headers } from "next/headers";
import { toActionError, type ActionResult } from "@/server/errors";

/** Wrap a server-action body: converts known errors into a friendly ActionResult. */
export async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    return toActionError(e);
  }
}
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
