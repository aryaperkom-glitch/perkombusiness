import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getClaimWithRelations } from "@/lib/claims";
import { sendTextMessage, buildClaimMessage, buildManagerApprovalMessage, buildHrApprovalMessage } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  try {
    const { claim_id, manager_id, hr_id, target = "EMPLOYEE" } = await request.json();

    if (!claim_id) {
    return NextResponse.json(
      { success: false, error: "claim_id wajib diisi" },
      { status: 400 }
    );
  }

  // Get claim with employee, manager, hr, and trips
  const claim = await getClaimWithRelations(claim_id);

  if (!claim) {
    return NextResponse.json(
      { success: false, error: "Claim tidak ditemukan" },
      { status: 404 }
    );
  }

  if (!claim.employee) {
    return NextResponse.json(
      { success: false, error: "Employee belum terhubung dengan claim ini" },
      { status: 400 }
    );
  }

  let phoneNumber = claim.employee.phone_number;
  let message = "";
  let messageType = "CLAIM_NOTIFICATION";

  if (target === "EMPLOYEE") {
    message = buildClaimMessage({
      employee_name: claim.employee.employee_name,
      period: claim.period,
      trip_count: claim.trip_count,
      total_amount: claim.total_amount,
      trips: claim.trips || []
    });
  } else if (target === "MANAGER") {
    if (!claim.manager) {
      return NextResponse.json({ success: false, error: "Manager belum diatur untuk klaim ini" }, { status: 400 });
    }
    phoneNumber = claim.manager.phone_number;
    messageType = "MANAGER_APPROVAL_PROMPT";
    message = buildManagerApprovalMessage({
      employee_name: claim.employee.employee_name,
      period: claim.period,
      total_amount: claim.total_amount,
      trips: claim.trips || []
    });
  } else if (target === "HR") {
    if (!claim.hr) {
      return NextResponse.json({ success: false, error: "HR belum diatur untuk klaim ini" }, { status: 400 });
    }
    phoneNumber = claim.hr.phone_number;
    messageType = "HR_APPROVAL_PROMPT";
    message = buildHrApprovalMessage({
      employee_name: claim.employee.employee_name,
      manager_name: claim.manager?.employee_name || "Manager",
      period: claim.period,
      total_amount: claim.total_amount,
      trips: claim.trips || []
    });
  }

  // Normalize phone number (must start with country code, no + or leading 0)
  const normalizedPhone = phoneNumber.replace(/^\+/, "").replace(/^0/, "62");

  // Send via Kirimi API directly
  const result = await sendTextMessage(normalizedPhone, message);

  // Log the attempt
  await query(
    `INSERT INTO whatsapp_logs (claim_id, phone_number, message_type, status, response)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      claim_id,
      phoneNumber,
      messageType,
      result.success ? "SENT" : "FAILED",
      JSON.stringify(result),
    ]
  );

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || "Gagal mengirim WhatsApp" },
      { status: 500 }
    );
  }

  // Only update general claim status if sending to EMPLOYEE
  if (target === "EMPLOYEE") {
    await query(
      `UPDATE claims SET
         status = 'SENT',
         manager_id = $1,
         hr_id = $2,
         wa_sent = true,
         wa_sent_at = $3
       WHERE id = $4`,
      [
        manager_id !== undefined ? manager_id : claim.employee.manager_id,
        hr_id !== undefined ? hr_id : claim.employee.hr_id,
        new Date().toISOString(),
        claim_id,
      ]
    );
  }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unhandled error in /api/whatsapp/send:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
