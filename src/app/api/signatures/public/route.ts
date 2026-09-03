import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { z } from "zod";

const publicRegistrationSchema = z.object({
  employee_name: z.string().min(1, "Nama wajib diisi"),
  department: z.string().optional(),
  phone_number: z.string().min(1, "Nomor telepon wajib diisi"),
  signature: z.string().min(1, "Tanda tangan wajib diisi"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = publicRegistrationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { employee_name, department, phone_number, signature } = result.data;

    // 1. Cek apakah employee sudah ada berdasarkan Nomor Telepon atau Nama
    const existingPhone = await queryOne(
      "SELECT id FROM employees WHERE phone_number = $1 LIMIT 1",
      [phone_number]
    );

    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp ini sudah pernah didaftarkan." },
        { status: 400 }
      );
    }

    const existingName = await queryOne(
      "SELECT id FROM employees WHERE employee_name ILIKE $1 LIMIT 1",
      [employee_name]
    );

    if (existingName) {
      return NextResponse.json(
        { success: false, error: "Nama ini sudah pernah didaftarkan." },
        { status: 400 }
      );
    }

    // Jika belum ada, buat employee baru
    const generatedEmpNumber = `EMP-${Math.floor(Date.now() / 1000)}`; // Generate random NIP

    const newEmp = await queryOne(
      `INSERT INTO employees
         (employee_number, employee_name, department, phone_number, role, is_active)
       VALUES ($1, $2, $3, $4, 'EMPLOYEE', true)
       RETURNING id`,
      [generatedEmpNumber, employee_name, department, phone_number]
    );

    if (!newEmp) {
      return NextResponse.json(
        {
          success: false,
          error: "Gagal mendaftarkan karyawan baru: ",
        },
        { status: 500 }
      );
    }
    const employeeId = newEmp.id;

    // 2. Upsert signature
    await query(
      `INSERT INTO signatures (employee_id, signature, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (employee_id) DO UPDATE
         SET signature = EXCLUDED.signature, updated_at = EXCLUDED.updated_at`,
      [employeeId, signature, new Date().toISOString()]
    );

    return NextResponse.json({
      success: true,
      message: `Data dan tanda tangan untuk ${employee_name} berhasil disimpan!`,
      data: {
        employee_id: employeeId,
        employee_name,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan sistem";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
