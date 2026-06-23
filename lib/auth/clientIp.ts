/** Best-effort client IP behind Vercel / reverse proxies. Trust only platform-forwarded headers. */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return null;
}

export function getUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent")?.trim();
  return ua || null;
}