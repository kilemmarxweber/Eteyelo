import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";
  const pathname = req.nextUrl.pathname;

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
