// txline (Cloudflare) is intermittently flaky from some networks — retry.
export async function fetchRetry(url: string, init: RequestInit, tries = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

/** True only when the caller presents a JWT whose role claim is service_role.
 *  The platform gateway (verify_jwt) has already verified the signature, so we
 *  only need to read the role — this blocks anon-key callers (the anon key is
 *  public in the frontend) while allowing the cron job's service-role calls. */
export function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}
