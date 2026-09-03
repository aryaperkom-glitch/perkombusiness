import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // If requesting distinct periods
    if (searchParams.get("distinct_periods") === "true") {
      const { rows } = await query(
        "SELECT DISTINCT period FROM claims ORDER BY period DESC"
      );
      return NextResponse.json({
        success: true,
        data: rows.map((r) => r.period),
      });
    }

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const period = searchParams.get("period") || "";

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

    const { rows } = await query(
      `SELECT c.*, to_jsonb(e) AS employee
       FROM claims c
       LEFT JOIN employees e ON c.employee_id = e.id
       ${where}
       ORDER BY c.updated_at DESC`,
      params
    );

    // Client-side search filter (employee name/number)
    let filtered = rows;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.employee?.employee_name?.toLowerCase().includes(s) ||
          c.employee?.employee_number?.toLowerCase().includes(s)
      );
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
