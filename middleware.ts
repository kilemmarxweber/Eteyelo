import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";
  const pathname = req.nextUrl.pathname;

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

export const config = {
  matcher: ["/api/auth/:path*", "/admin", "/admin/:path*"],
};
