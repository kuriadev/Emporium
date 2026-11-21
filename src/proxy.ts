import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./server/auth/token";

const CUSTOMER_ONLY = [/^\/account(\/|$)/, /^\/orders(\/|$)/, /^\/checkout(\/|$)/];

function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'" + (dev ? " ws: wss:" : ""),
    "worker-src 'self' blob:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    dev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!claims || claims.role !== "admin" || !claims.ar) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", pathname + search);
      if (claims && claims.role !== "admin") url.searchParams.set("reason", "staff-only");
      return NextResponse.redirect(url);
    }
  }

  if (CUSTOMER_ONLY.some((re) => re.test(pathname)) && !claims) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && claims?.role === "customer") {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|images|lottie|media|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
