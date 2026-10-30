// CLD-20: every signed-in path from before /cloud answers a permanent redirect to its new path, with its
// query kept. Each page under /cloud sends a signed-out visit to /cloud/signin itself.
import { NextResponse, type NextRequest } from "next/server";
import { accountPath, CLOUD_SETTINGS, repoPath, repoSettingsPath, signInPath, startPath } from "./lib/paths";

/** The first path segments that belong to the public site, the API and Next.js. Everything else was an account. */
const SITE = new Set(["", "api", "cloud", "s", "docs", "gallery", "get-started", "install", "pricing", "privacy", "stats", "fonts", "_next"]);

/** The new path of a signed-in path from before /cloud, or `null` for any other path. */
function movedTo(segments: string[], params: URLSearchParams): string | null {
  const [first = "", second, ...rest] = segments;
  if (first === "") {
    const upgraded = params.get("upgraded");
    const account = params.get("account");
    return upgraded !== null ? startPath(upgraded, true) : account !== null ? startPath(account) : null;
  }
  if (first === "signin" && second === undefined) return signInPath() + (params.size > 0 ? `?${params}` : "");
  if (first === "settings") return second === undefined ? CLOUD_SETTINGS : rest.length === 1 ? repoSettingsPath(second, rest[0]!) : null;
  // Logins hold no dots, so one segment with a dot is a file such as /icon.png.
  if (SITE.has(first) || (second === undefined && first.includes("."))) return null;
  if (second === undefined) return accountPath(first, "dashboard");
  if (second === "team" && rest.length === 0) return accountPath(first, "people");
  const query = params.size > 0 ? `?${params}` : "";
  return [repoPath(first, second), ...rest.map(encodeURIComponent)].join("/") + query;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  const segments = pathname.split("/").slice(1).map((segment) => decodeURIComponent(segment));
  const moved = movedTo(segments, searchParams);
  return moved === null ? NextResponse.next() : NextResponse.redirect(new URL(moved, request.url), 308);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|api/).*)",
};
