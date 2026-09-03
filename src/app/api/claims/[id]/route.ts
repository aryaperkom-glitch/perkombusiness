import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

// Columns that may be updated through this endpoint
const UPDATABLE_CLAIM_COLUMNS = [
  "status",
  "manager_status",
  "hr_status",
  "manager_id",
  "hr_id",
  "approved_at",
  "wa_sent",
  "wa_sent_at",
  "employee_id",
  "period",
  "trip_count",
  "total_amount",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const claim = await queryOne(
    `SELECT c.*, to_jsonb(e) AS employee
     FROM claims c
     LEFT JOIN employees e ON c.employee_id = e.id
     WHERE c.id = $1`,
    [id]
  );

  if (!claim) {
    return NextResponse.json(
      { success: false, error: "Claim tidak ditemukan" },
      { status: 404 }
    );
  }

  const { rows: trips } = await query(
    "SELECT * FROM trips WHERE claim_id = $1 ORDER BY trip_date ASC",
    [id]
  );

  const { rows: comments } = await query(
    "SELECT * FROM comments WHERE claim_id = $1 ORDER BY created_at ASC",
    [id]
  );

  let ticket = null;
  if (claim.employee?.employee_name) {
    const tickets = await queryOne(
      `SELECT * FROM managed_service_claims
       WHERE customer_name ILIKE $1
       ORDER BY created_at DESC LIMIT 1`,
      [claim.employee.employee_name]
    );

    if (tickets) {
      ticket = tickets;
    } else if (claim.status === "APPROVED") {
      // Mock ticket for demonstration if none found but claim is approved
      ticket = {
        ticket_id: "32535",
        ticket_title:
          "Preventive Maintenance (PM 1 of 4) Server DRC - Resona Indonesia Finance",
        customer_name: "Resona Indonesia Finance",
        location: "Jabodetabek",
        amount: claim.total_amount,
      };
    }
  }

  const employeeIdToUse = claim.employee_id;
  const managerIdToUse = claim.manager_id || claim.employee?.manager_id;
  const hrIdToUse = claim.hr_id || claim.employee?.hr_id;

  const employee_signature = employeeIdToUse
    ? (await queryOne("SELECT signature FROM signatures WHERE employee_id = $1", [
        employeeIdToUse,
      ]))?.signature ?? null
    : null;

  const manager_signature = managerIdToUse
    ? (await queryOne("SELECT signature FROM signatures WHERE employee_id = $1", [
        managerIdToUse,
      ]))?.signature ?? null
    : null;

  const hr_signature = hrIdToUse
    ? (await queryOne("SELECT signature FROM signatures WHERE employee_id = $1", [
        hrIdToUse,
      ]))?.signature ?? null
    : null;

  return NextResponse.json({
    success: true,
    data: {
      ...claim,
      trips: trips || [],
      comments: comments || [],
      ticket,
      manager_signature,
      hr_signature,
      employee_signature,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { manager_signature, hr_signature, ...updateData } = body;

  // If there are signatures, fetch the claim first to get the employee IDs
  if (manager_signature || hr_signature) {
    const claimInfo = await queryOne(
      `SELECT c.manager_id, c.hr_id, to_jsonb(e) AS employee
       FROM claims c
       LEFT JOIN employees e ON c.employee_id = e.id
       WHERE c.id = $1`,
      [id]
    );

    if (claimInfo) {
      const employee = claimInfo.employee;
      const managerIdToUse = claimInfo.manager_id || employee?.manager_id;
      const hrIdToUse = claimInfo.hr_id || employee?.hr_id;

      if (manager_signature && managerIdToUse) {
        await query(
          `INSERT INTO signatures (employee_id, signature, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (employee_id) DO UPDATE
             SET signature = EXCLUDED.signature, updated_at = EXCLUDED.updated_at`,
          [managerIdToUse, manager_signature, new Date().toISOString()]
        );
      }
      if (hr_signature && hrIdToUse) {
        await query(
          `INSERT INTO signatures (employee_id, signature, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (employee_id) DO UPDATE
             SET signature = EXCLUDED.signature, updated_at = EXCLUDED.updated_at`,
          [hrIdToUse, hr_signature, new Date().toISOString()]
        );
      }
    }
  }

  const entries = Object.entries(updateData).filter(([key]) =>
    UPDATABLE_CLAIM_COLUMNS.includes(key)
  );

  try {
    if (entries.length > 0) {
      const setSql = entries
        .map(([key], i) => `"${key}" = $${i + 1}`)
        .join(", ");
      const values = entries.map(([, value]) => value);
      await query(
        `UPDATE claims SET ${setSql} WHERE id = $${entries.length + 1}`,
        [...values, id]
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
