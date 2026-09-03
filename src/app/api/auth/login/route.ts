import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const user =
    typeof email === "string" && typeof password === "string"
      ? await queryOne<{ id: string; password_hash: string }>(
          "SELECT id, password_hash FROM app_users WHERE email = $1",
          [email.toLowerCase().trim()]
        )
      : null;

  // Same message for unknown email and wrong password (no user enumeration)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json(
      { success: false, error: "Email atau password salah." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(sessionCookie.name, createSessionToken(user.id), sessionCookie);
  return response;
}
