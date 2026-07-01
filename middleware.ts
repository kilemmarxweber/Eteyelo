import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || '';
  req.nextUrl.searchParams.set('userAgent', userAgent);
  return NextResponse.next();
}

export const config = {
  matcher: '/api/auth/:path*',
};
