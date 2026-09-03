import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import dayjs from "dayjs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const period = searchParams.get("period") || "";

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (period) {
      params.push(period);
      conditions.push(`c.period = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows: data } = await query(
      `SELECT c.*, to_jsonb(e) AS employee
       FROM claims c
       LEFT JOIN employees e ON c.employee_id = e.id
       ${where}
       ORDER BY c.updated_at DESC`,
      params
    );

    // Build CSV
    const header = [
      "Employee Number",
      "Employee Name",
      "Department",
      "Period",
      "Trip Count",
      "Total Amount",
      "Status",
      "Approved Date",
    ].join(",");

    const rows =
      data?.map((claim) => {
        return [
          claim.employee?.employee_number || "",
          `"${claim.employee?.employee_name || ""}"`,
          `"${claim.employee?.department || ""}"`,
          claim.period,
          claim.trip_count,
          claim.total_amount,
          claim.status,
          claim.approved_at
            ? dayjs(claim.approved_at).format("YYYY-MM-DD HH:mm")
            : "",
        ].join(",");
      }) || [];

    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="claims_report_${dayjs().format("YYYYMMDD")}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
