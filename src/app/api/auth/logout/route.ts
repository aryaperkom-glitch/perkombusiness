import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(sessionCookie.name, "", { ...sessionCookie, maxAge: 0 });
  return response;
}
