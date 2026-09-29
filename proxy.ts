import { NextRequest, NextResponse } from "next/server";

/**
 * Network boundary (convention Next.js 16 : `proxy.ts`, anciennement `middleware.ts`).
 * Pas d’auth rôle ici — les gates métier sont dans les layouts / pages (unit-09).
 */
const MOBILE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, set-auth-token",
  "Access-Control-Expose-Headers": "set-auth-token",
  "Access-Control-Max-Age": "86400",
} as const;

function withMobileCors(res: NextResponse) {
  for (const [key, value] of Object.entries(MOBILE_CORS_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export function proxy(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";
  const pathname = req.nextUrl.pathname;

  // Flutter web (Chrome) → API mobile : CORS + preflight OPTIONS
  if (pathname.startsWith("/api/mobile")) {
    if (req.method === "OPTIONS") {
      return withMobileCors(new NextResponse(null, { status: 204 }));
    }
    return withMobileCors(NextResponse.next());
  }

  // Ancienne URL /branches/enter/:branchId — conflit de route avec [branchId].
  // Redirige vers le dashboard branche (activation faite dans le layout).
  const enterMatch = pathname.match(
    /^(\/admin\/organizations\/[^/]+\/branches)\/enter\/([^/]+)\/?$/,
  );
  if (enterMatch) {
    const url = req.nextUrl.clone();
    url.pathname = `${enterMatch[1]}/${enterMatch[2]}`;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  req.nextUrl.searchParams.set("userAgent", userAgent);
  return NextResponse.next();
}
