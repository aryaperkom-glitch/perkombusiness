import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { employeeSchema } from "@/lib/validations/employee";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";

  try {
    const conditions: string[] = ["is_active = true"];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      const p = params.length;
      conditions.push(
        `(employee_name ILIKE $${p} OR employee_number ILIKE $${p})`
      );
    }

    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }

    const { rows: data } = await query(
      `SELECT * FROM employees
       WHERE ${conditions.join(" AND ")}
       ORDER BY employee_name ASC`,
      params
    );

    const signaturesMap: Record<string, string> = {};

    // Try fetching signatures safely, so it doesn't break if the table doesn't exist yet
    try {
      const { rows: sigData } = await query(
        "SELECT employee_id, signature FROM signatures"
      );
      sigData.forEach((s) => {
        signaturesMap[s.employee_id] = s.signature;
      });
    } catch {
      // Ignore error if table doesn't exist
    }

    const mappedData = data?.map((emp) => ({
      ...emp,
      signature: signaturesMap[emp.id] || null,
    }));

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = employeeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  let data = null;
  try {
    data = await queryOne(
      `INSERT INTO employees
         (employee_number, employee_name, department, phone_number, role, manager_id, hr_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        result.data.employee_number,
        result.data.employee_name,
        result.data.department,
        result.data.phone_number,
        result.data.role,
        result.data.manager_id || null,
        result.data.hr_id || null,
      ]
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { success: false, error: "Employee number sudah digunakan" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }

  if (data && result.data.signature) {
    try {
      await query(
        `INSERT INTO signatures (employee_id, signature, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (employee_id) DO UPDATE
           SET signature = EXCLUDED.signature, updated_at = EXCLUDED.updated_at`,
        [data.id, result.data.signature, new Date().toISOString()]
      );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Gagal menyimpan tanda tangan: " + (error as Error).message,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data });
}
