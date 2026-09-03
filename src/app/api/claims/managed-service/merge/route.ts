import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { managedClaimId, grabClaimId } = await request.json();

    if (!managedClaimId || !grabClaimId) {
      return NextResponse.json(
        { success: false, error: "Missing required IDs" },
        { status: 400 }
      );
    }

    // 1. Fetch managed_service_claim
    const managedClaim = await queryOne(
      "SELECT id, amount FROM managed_service_claims WHERE id = $1",
      [managedClaimId]
    );

    if (!managedClaim) {
      return NextResponse.json(
        { success: false, error: "Managed Claim not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Grab claim
    const grabClaim = await queryOne(
      "SELECT id, total_amount, status FROM claims WHERE id = $1",
      [grabClaimId]
    );

    if (!grabClaim) {
      return NextResponse.json(
        { success: false, error: "Grab Claim not found" },
        { status: 404 }
      );
    }

    if (grabClaim.status === "MERGED") {
      return NextResponse.json(
        { success: false, error: "Grab Claim is already merged" },
        { status: 400 }
      );
    }

    // 3. Update managed_service_claim amount
    const newAmount = Number(managedClaim.amount) + Number(grabClaim.total_amount);
    await query("UPDATE managed_service_claims SET amount = $1 WHERE id = $2", [
      newAmount,
      managedClaimId,
    ]);

    // 4. Update grab claim status
    await query("UPDATE claims SET status = 'MERGED' WHERE id = $1", [
      grabClaimId,
    ]);

    return NextResponse.json({
      success: true,
      message: "Successfully merged claims",
    });
  } catch (error) {
    console.error("Merge error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
