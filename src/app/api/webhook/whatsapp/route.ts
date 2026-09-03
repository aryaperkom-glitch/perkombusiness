import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getClaimWithRelations, listActiveClaims } from "@/lib/claims";
import type { Trip } from "@/types";
import {
  sendTextMessage,
  buildDetailMessage,
  buildConfirmationMessage,
  buildCorrectionPrompt,
  buildManagerApprovalMessage,
  buildHrApprovalMessage,
  buildEmployeeStatusUpdateMessage
} from "@/lib/whatsapp";

function normalizePhone(phone: string | undefined | null) {
  if (!phone) return null;
  return phone.replace(/^\+/, "").replace(/^0/, "62").replace("@lid", "");
}

// Helper: send WA and log result
async function sendAndLog(
  claimId: string,
  phone: string,
  message: string,
  messageType: string
): Promise<boolean> {
  const result = await sendTextMessage(phone, message);

  await query(
    `INSERT INTO whatsapp_logs (claim_id, phone_number, message_type, status, response)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      claimId,
      phone,
      messageType,
      result.success ? "SENT" : "FAILED",
      result.success ? message.slice(0, 200) : (result.error || "Unknown error"),
    ]
  );

  if (!result.success) {
    console.error(`[WA] FAILED to send ${messageType} to ${phone} for claim ${claimId}: ${result.error}`);
  }

  return result.success;
}

// Helper: proceed to HR approval or auto-finalize
async function proceedToHrOrFinalize(
  claim: NonNullable<Awaited<ReturnType<typeof getClaimWithRelations>>>,
  employeePhone: string | null
) {
  if (claim.hr) {
    const hrPhone = normalizePhone(claim.hr.phone_number);
    if (hrPhone) {
      const sent = await sendAndLog(
        claim.id, hrPhone,
        buildHrApprovalMessage({
          employee_name: claim.employee?.employee_name || "Karyawan",
          manager_name: claim.manager?.employee_name || "Manager",
          period: claim.period,
          total_amount: claim.total_amount,
          trips: claim.trips || [],
        }),
        "HR_APPROVAL_PROMPT"
      );
      if (!sent) {
        console.error(`[FLOW] STUCK: Failed to send HR approval to ${hrPhone} for claim ${claim.id}`);
      }
    } else {
      console.error(`[FLOW] STUCK: HR has no phone number for claim ${claim.id}`);
    }
  } else {
    // No HR → auto finalize
    await query(
      "UPDATE claims SET status = 'APPROVED', hr_status = 'APPROVED' WHERE id = $1",
      [claim.id]
    );
    if (employeePhone) {
      await sendAndLog(
        claim.id, employeePhone,
        buildEmployeeStatusUpdateMessage("FINALIZED", "Sistem", "HR"),
        "EMPLOYEE_STATUS_UPDATE"
      );
    }
  }
}

// ==========================================
// Main processing logic
// ==========================================
async function processWebhookReply(
  claim: NonNullable<Awaited<ReturnType<typeof getClaimWithRelations>>>,
  role: string,
  reply: string,
  phoneNumber: string,
) {
  const employeePhone = normalizePhone(claim.employee?.phone_number);

  try {
    // ==========================================
    // ROLE: EMPLOYEE
    // ==========================================
    if (role === 'EMPLOYEE') {
      if (reply === "1") {
        const hasManager = !!claim.manager;
        await query(
          `UPDATE claims SET
             approved_at = $1,
             manager_status = $2,
             hr_status = 'PENDING'
           WHERE id = $3`,
          [new Date().toISOString(), hasManager ? "PENDING" : "APPROVED", claim.id]
        );

        const confirmMsg = buildConfirmationMessage(hasManager ? claim.manager.employee_name : undefined);
        if (employeePhone) {
          await sendAndLog(claim.id, employeePhone, confirmMsg, "EMPLOYEE_CONFIRMATION");
        }

        if (hasManager) {
          const mgrPhone = normalizePhone(claim.manager.phone_number);
          if (mgrPhone) {
            const sent = await sendAndLog(
              claim.id, mgrPhone,
              buildManagerApprovalMessage({
                employee_name: claim.employee.employee_name,
                period: claim.period,
                total_amount: claim.total_amount,
                trips: claim.trips || [],
              }),
              "MANAGER_APPROVAL_PROMPT"
            );
            if (!sent) {
              console.error(`[FLOW] STUCK: Failed to send manager approval to ${mgrPhone} for claim ${claim.id}`);
            }
          }
        } else {
          await query(
            "UPDATE claims SET manager_status = 'APPROVED' WHERE id = $1",
            [claim.id]
          );
          const freshClaim = await getClaimWithRelations(claim.id);
          if (freshClaim) {
            await proceedToHrOrFinalize(freshClaim, employeePhone);
          }
        }

      } else if (reply === "2") {
        await query(
          "UPDATE claims SET status = 'NEED_REVIEW' WHERE id = $1",
          [claim.id]
        );
        if (employeePhone) {
          await sendAndLog(claim.id, employeePhone, buildCorrectionPrompt(), "CORRECTION_PROMPT");
        }
      } else if (reply === "3") {
        const { rows: trips } = await query(
          "SELECT * FROM trips WHERE claim_id = $1 ORDER BY trip_date ASC",
          [claim.id]
        );
        if (trips && trips.length > 0 && employeePhone) {
          await sendAndLog(claim.id, employeePhone, buildDetailMessage(trips as Trip[], claim.total_amount), "DETAIL_MESSAGE");
        }
      } else {
        if (claim.status === "NEED_REVIEW" || reply.length > 5) {
          await query(
            "INSERT INTO comments (claim_id, message) VALUES ($1, $2)",
            [claim.id, reply]
          );
          if (claim.status !== "NEED_REVIEW") {
            await query(
              "UPDATE claims SET status = 'NEED_REVIEW' WHERE id = $1",
              [claim.id]
            );
          }
        }
      }
    }

    // ==========================================
    // ROLE: MANAGER
    // ==========================================
    else if (role === 'MANAGER') {
      if (reply === "1") {
        await query(
          "UPDATE claims SET manager_status = 'APPROVED' WHERE id = $1",
          [claim.id]
        );
        await sendAndLog(claim.id, phoneNumber, "Terima kasih, klaim telah Anda setujui.", "MANAGER_CONFIRMED");

        if (employeePhone) {
          await sendAndLog(
            claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("APPROVED", claim.manager?.employee_name || "Manager", "MANAGER"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }

        const freshClaim = await getClaimWithRelations(claim.id);
        if (freshClaim) {
          await proceedToHrOrFinalize(freshClaim, employeePhone);
        }

      } else if (reply === "2") {
        await query(
          "UPDATE claims SET manager_status = 'REJECTED', status = 'NEED_REVIEW' WHERE id = $1",
          [claim.id]
        );
        await sendAndLog(claim.id, phoneNumber, "Klaim telah ditolak.", "MANAGER_REJECTED");
        if (employeePhone) {
          await sendAndLog(
            claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("REJECTED", claim.manager?.employee_name || "Manager", "MANAGER"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else {
        await sendAndLog(claim.id, phoneNumber, "Balasan tidak valid. Silakan balas 1 untuk Approve atau 2 untuk Reject.", "INVALID_REPLY");
      }
    }

    // ==========================================
    // ROLE: HR
    // ==========================================
    else if (role === 'HR') {
      if (reply === "1") {
        await query(
          "UPDATE claims SET hr_status = 'APPROVED', status = 'APPROVED' WHERE id = $1",
          [claim.id]
        );
        await sendAndLog(claim.id, phoneNumber, "Terima kasih, klaim telah selesai Anda setujui.", "HR_CONFIRMED");
        if (employeePhone) {
          await sendAndLog(
            claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("FINALIZED", claim.hr?.employee_name || "HR", "HR"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else if (reply === "2") {
        await query(
          "UPDATE claims SET hr_status = 'REJECTED', status = 'NEED_REVIEW' WHERE id = $1",
          [claim.id]
        );
        await sendAndLog(claim.id, phoneNumber, "Klaim telah ditolak.", "HR_REJECTED");
        if (employeePhone) {
          await sendAndLog(
            claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("REJECTED", claim.hr?.employee_name || "HR", "HR"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else {
        await sendAndLog(claim.id, phoneNumber, "Balasan tidak valid. Silakan balas 1 untuk Approve atau 2 untuk Reject.", "INVALID_REPLY");
      }
    }

    // Log the interaction
    await query(
      `INSERT INTO whatsapp_logs (claim_id, phone_number, message_type, status, response)
       VALUES ($1, $2, $3, 'RECEIVED', $4)`,
      [claim.id, phoneNumber, `${role}_REPLY`, reply]
    );

  } catch (error) {
    console.error(`[FLOW] Error processing ${role} reply for claim ${claim.id}:`, error);
  }
}

// ==========================================
// POST handler — responds immediately, processes in background
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log raw payload
    try {
      await query(
        `INSERT INTO whatsapp_logs (claim_id, phone_number, message_type, status, response)
         VALUES ($1, 'SYSTEM', 'RAW_WEBHOOK', 'RECEIVED', $2)`,
        ["1aedea14-57ef-4929-8d27-f6b8b513cbe0", JSON.stringify(body)]
      );
    } catch (e) {
      console.error("Log error", e);
    }

    const sender = body.sender || body.from || body.phone || "";
    let messageText = "";

    if (body.message && typeof body.message === "object" && body.message.text) {
      messageText = body.message.text.trim();
    } else if (typeof body.message === "string") {
      messageText = body.message.trim();
    } else if (typeof body.text === "string") {
      messageText = body.text.trim();
    }

    if (!sender || !messageText) {
      return NextResponse.json({ success: true });
    }

    const phoneNumber = normalizePhone(sender);
    if (!phoneNumber) return NextResponse.json({ success: true });

    // Fetch active claims
    const claims = await listActiveClaims();

    if (!claims || claims.length === 0) {
      return NextResponse.json({ success: true, reason: "No active claims" });
    }

    let claim = null;
    let role = null;

    for (const c of claims) {
      if (!c.employee) continue;

      const empPhone = normalizePhone(c.employee.phone_number);
      const mgrPhone = c.manager ? normalizePhone(c.manager.phone_number) : null;
      const hrPhone = c.hr ? normalizePhone(c.hr.phone_number) : null;

      if (hrPhone && hrPhone === phoneNumber && c.approved_at && c.manager_status === 'APPROVED' && c.hr_status === 'PENDING') {
        claim = c; role = 'HR'; break;
      }
      if (mgrPhone && mgrPhone === phoneNumber && c.approved_at && c.manager_status === 'PENDING') {
        claim = c; role = 'MANAGER'; break;
      }
      if (empPhone === phoneNumber && !c.approved_at) {
        claim = c; role = 'EMPLOYEE'; break;
      }
    }

    if (!claim || !role) {
      return NextResponse.json({ success: true, reason: "No matching claim/role" });
    }

    const reply = messageText.trim();

    // Process directly. We await it so Vercel doesn't kill the process.
    // With maxRetries=1, 2 messages * 2s delay = ~4-5s total, well within Vercel's 10s limit.
    await processWebhookReply(claim, role!, reply, phoneNumber);

    // Respond immediately to Kirimi webhook (no timeout risk)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
