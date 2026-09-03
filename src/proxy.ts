import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const userId = verifySessionToken(request.cookies.get(sessionCookie.name)?.value);

  // Protected routes (pages and API endpoints)
  const protectedPaths = [
    "/dashboard",
    "/employees",
    "/upload",
    "/claims",
    "/services",
    "/api/services",
    "/api/upload",
    "/api/claims",
    "/api/employees",
    "/api/files",
  ];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !userId) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from login page
  if (request.nextUrl.pathname === "/login" && userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect root to dashboard
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = userId ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
