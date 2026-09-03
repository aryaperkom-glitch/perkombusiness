import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    const { rows: data } = await query(
      "SELECT * FROM managed_service_claims ORDER BY created_at DESC"
    );

    // Fetch pending Grab claims
    const { rows: grabClaims } = await query(
      `SELECT c.id, c.total_amount, c.status, c.period, e.employee_name
       FROM claims c
       LEFT JOIN employees e ON c.employee_id = e.id
       WHERE c.status = 'PENDING'`
    );

    // Attach grab_match if customer_name matches employee name
    const enrichedData = data.map((mClaim) => {
      let grab_match = null;
      if (mClaim.customer_name) {
        const match = grabClaims.find(
          (gc) =>
            gc.employee_name &&
            gc.employee_name.toLowerCase() ===
              mClaim.customer_name?.toLowerCase()
        );
        if (match) {
          grab_match = match;
        }
      }
      return {
        ...mClaim,
        grab_match,
      };
    });

    return NextResponse.json({ success: true, data: enrichedData });
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

  const ticket_id = formData.get("ticket_id") as string;
  const ticket_title = formData.get("ticket_title") as string;
  const customer_name = formData.get("customer_name") as string;
  const location = formData.get("location") as string;
  const amount = formData.get("amount") as string;
  const file = formData.get("file") as File;

  if (!ticket_id || !file || !amount) {
    return NextResponse.json(
      { success: false, error: "Ticket ID, Amount, dan file wajib diisi" },
      { status: 400 }
    );
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase();
  if (!["jpg", "jpeg", "png", "pdf"].includes(fileExt || "")) {
    return NextResponse.json(
      { success: false, error: "File harus berupa Gambar (JPG/PNG) atau PDF" },
      { status: 400 }
    );
  }

  // Save to the local uploads volume, served by /api/files
  const fileName = `${Date.now()}_ticket_${ticket_id}.${fileExt}`;
  const storageKey = `managed-service/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveFile(storageKey, buffer);

  const fileUrl = `/api/files/${storageKey}`;

  // Save metadata
  try {
    const data = await queryOne(
      `INSERT INTO managed_service_claims
         (ticket_id, ticket_title, customer_name, location, amount, file_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        ticket_id,
        ticket_title,
        customer_name,
        location,
        parseFloat(amount),
        fileUrl,
      ]
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
