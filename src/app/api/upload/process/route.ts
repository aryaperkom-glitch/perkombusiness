import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { readFileFromStorage } from "@/lib/storage";
import { query, queryOne } from "@/lib/db";
import { parseGrabCSV, parseGrabPDF, groupTripsByEmployee } from "@/lib/parser";

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { upload_id } = await request.json();

  if (!upload_id) {
    return NextResponse.json(
      { success: false, error: "upload_id wajib diisi" },
      { status: 400 }
    );
  }

  // Get upload record
  const upload = await queryOne("SELECT * FROM uploads WHERE id = $1", [
    upload_id,
  ]);

  if (!upload) {
    return NextResponse.json(
      { success: false, error: "Upload tidak ditemukan" },
      { status: 404 }
    );
  }

  // Load file from the uploads volume
  let buffer: Buffer;
  try {
    buffer = await readFileFromStorage(upload.storage_path);
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal mengunduh file" },
      { status: 500 }
    );
  }

  try {
    // Get all employees for matching
    const { rows: employees } = await query(
      "SELECT * FROM employees WHERE is_active = true"
    );

    // Parse the file
    let trips;
    if (upload.file_type === "csv") {
      trips = parseGrabCSV(buffer.toString("utf-8"));
    } else {
      trips = await parseGrabPDF(buffer, employees || []);
    }

    if (trips.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada data trip yang ditemukan" },
        { status: 400 }
      );
    }

    // Group trips by employee
    const grouped = groupTripsByEmployee(trips);

    let claimsCreated = 0;

    for (const group of grouped) {
      // Try to match employee by name (case-insensitive)
      const matchedEmployee = employees?.find(
        (emp) =>
          emp.employee_name.toLowerCase() ===
          group.employee_name.toLowerCase()
      );

      // Create claim
      let claim = null;
      try {
        claim = await queryOne(
          `INSERT INTO claims
             (employee_id, upload_id, period, trip_count, total_amount, status, manager_id, hr_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            matchedEmployee?.id || null,
            upload.id,
            upload.period,
            group.trip_count,
            group.total_amount,
            matchedEmployee ? "PENDING" : "UNMATCHED",
            matchedEmployee?.manager_id || null,
            matchedEmployee?.hr_id || null,
          ]
        );
      } catch (claimError) {
        console.error("Failed to insert claim:", claimError);
        continue;
      }

      if (!claim) continue;

      // Create trips
      const tripRecords = group.trips.map((t) => ({
        claim_id: claim.id,
        trip_date: t.trip_date
          ? new Date(t.trip_date).toISOString()
          : new Date().toISOString(),
        booking_id: t.booking_id,
        service_type: t.service_type,
        payment_method: t.payment_method,
        employee_group: t.employee_group,
        cost_code: t.cost_code,
        pickup: t.pickup,
        dropoff: t.dropoff,
        fare: t.fare,
      }));

      try {
        const values = tripRecords
          .map((_, i) => {
            const b = i * 10;
            return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10})`;
          })
          .join(", ");
        const params = tripRecords.flatMap((t) => [
          t.claim_id,
          t.trip_date,
          t.booking_id,
          t.service_type,
          t.payment_method,
          t.employee_group,
          t.cost_code,
          t.pickup,
          t.dropoff,
          t.fare,
        ]);

        await query(
          `INSERT INTO trips
             (claim_id, trip_date, booking_id, service_type, payment_method,
              employee_group, cost_code, pickup, dropoff, fare)
           VALUES ${values}`,
          params
        );
      } catch (tripsError) {
        console.error("Failed to insert trips:", tripsError);
      }

      claimsCreated++;
    }

    // Update upload status
    await query("UPDATE uploads SET status = 'PROCESSED' WHERE id = $1", [
      upload_id,
    ]);

    return NextResponse.json({
      success: true,
      data: { claims_created: claimsCreated },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses file";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
