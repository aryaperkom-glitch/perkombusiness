import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await query(
      "SELECT * FROM uploads ORDER BY created_at DESC"
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const formData = await request.formData();

  const period = formData.get("period") as string;
  const file = formData.get("file") as File;

  if (!period || !file) {
    return NextResponse.json(
      { success: false, error: "Period dan file wajib diisi" },
      { status: 400 }
    );
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "pdf"].includes(fileExt || "")) {
    return NextResponse.json(
      { success: false, error: "File harus CSV atau PDF" },
      { status: 400 }
    );
  }

  // Save to the local uploads volume
  const fileName = `${Date.now()}_${file.name}`;
  const storagePath = `statements/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveFile(storagePath, buffer);

  // Save metadata
  try {
    const data = await queryOne(
      `INSERT INTO uploads
         (period, filename, file_type, storage_path, status, uploaded_by)
       VALUES ($1, $2, $3, $4, 'UPLOADED', $5)
       RETURNING *`,
      [period, file.name, fileExt, storagePath, userId]
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
