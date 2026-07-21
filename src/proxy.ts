import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = ["https://acudex.web.app", "http://localhost:3000"];
  const isAllowedOrigin = allowedOrigins.includes(origin);

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 200 });
    response.headers.set("Access-Control-Allow-Origin", isAllowedOrigin ? origin : "https://acudex.web.app");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
  }

  // Handle standard request
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", isAllowedOrigin ? origin : "https://acudex.web.app");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
