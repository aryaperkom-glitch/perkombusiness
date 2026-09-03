import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import Papa from "papaparse";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { success: false, error: "File tidak ditemukan" },
      { status: 400 }
    );
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { success: false, error: "Format CSV tidak valid" },
      { status: 400 }
    );
  }

  const employees = parsed.data
    .filter(
      (row) =>
        row.employee_number &&
        row.employee_name &&
        row.phone_number
    )
    .map((row) => ({
      employee_number: row.employee_number.trim(),
      employee_name: row.employee_name.trim(),
      department: row.department?.trim() || "",
      phone_number: row.phone_number.trim(),
      is_active: true,
    }));

  if (employees.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Tidak ada data valid. Pastikan kolom: employee_number, employee_name, phone_number",
      },
      { status: 400 }
    );
  }

  try {
    const values = employees
      .map((_, i) => {
        const b = i * 5;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
      })
      .join(", ");
    const params = employees.flatMap((e) => [
      e.employee_number,
      e.employee_name,
      e.department,
      e.phone_number,
      e.is_active,
    ]);

    await query(
      `INSERT INTO employees
         (employee_number, employee_name, department, phone_number, is_active)
       VALUES ${values}
       ON CONFLICT (employee_number) DO UPDATE SET
         employee_name = EXCLUDED.employee_name,
         department = EXCLUDED.department,
         phone_number = EXCLUDED.phone_number,
         is_active = EXCLUDED.is_active`,
      params
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { count: employees.length },
  });
}
