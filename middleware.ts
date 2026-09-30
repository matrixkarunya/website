// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page always
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // For /admin root, let the page component handle the redirect
  if (pathname === '/admin') {
    return NextResponse.next();
  }

  // Note: We can't check Firebase auth in middleware directly
  // The actual auth check happens in the page components using useAuth
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
