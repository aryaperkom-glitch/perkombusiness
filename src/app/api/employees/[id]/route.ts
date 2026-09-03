import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { employeeSchema } from "@/lib/validations/employee";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const result = employeeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const data = await queryOne(
      `UPDATE employees SET
         employee_name = $1,
         department = $2,
         phone_number = $3,
         role = $4,
         manager_id = $5,
         hr_id = $6
       WHERE id = $7
       RETURNING *`,
      [
        result.data.employee_name,
        result.data.department,
        result.data.phone_number,
        result.data.role,
        result.data.manager_id || null,
        result.data.hr_id || null,
        id,
      ]
    );

    if (data && result.data.signature !== undefined) {
      if (result.data.signature) {
        await query(
          `INSERT INTO signatures (employee_id, signature, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (employee_id) DO UPDATE
             SET signature = EXCLUDED.signature, updated_at = EXCLUDED.updated_at`,
          [data.id, result.data.signature, new Date().toISOString()]
        );
      } else if (result.data.signature === null) {
        // If signature is explicitly set to null, delete it
        await query("DELETE FROM signatures WHERE employee_id = $1", [data.id]);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await query("UPDATE employees SET is_active = false WHERE id = $1", [id]);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
