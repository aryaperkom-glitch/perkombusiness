import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { readFileFromStorage } from "@/lib/storage";

const MIME_TYPES: Record<string, string> = {
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!(await getSessionUserId())) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const key = (await params).path.join("/");

  try {
    const buffer = await readFileFromStorage(key);
    const extension = key.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "File tidak ditemukan" },
      { status: 404 }
    );
  }
}
