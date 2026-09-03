import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { ClaimDetail, Trip, Comment } from "@/types";
import { ClaimDetailView } from "@/components/claims/claim-detail";

interface ClaimDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClaimDetailPage({ params }: ClaimDetailPageProps) {
  const { id } = await params;

  // Fetch claim with employee
  const claim = await queryOne(
    `SELECT c.*, to_jsonb(e) AS employee
     FROM claims c
     LEFT JOIN employees e ON c.employee_id = e.id
     WHERE c.id = $1`,
    [id]
  );

  if (!claim) {
    notFound();
  }

  // Fetch trips
  const { rows: trips } = await query(
    "SELECT * FROM trips WHERE claim_id = $1 ORDER BY trip_date ASC",
    [id]
  );

  // Fetch comments
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
    } else if (claim.status === 'APPROVED') {
      ticket = {
        ticket_id: "32535",
        ticket_title: "Preventive Maintenance (PM 1 of 4) Server DRC - Resona Indonesia Finance",
        customer_name: "Resona Indonesia Finance",
        location: "Jabodetabek",
        amount: claim.total_amount
      };
    }
  }

  const employeeIdToUse = claim.employee_id;
  const managerIdToUse = claim.manager_id || claim.employee?.manager_id;
  const hrIdToUse = claim.hr_id || claim.employee?.hr_id;

  // Fetch employee signature
  let employee_signature = null;
  if (employeeIdToUse) {
    const empSig = await queryOne(
      "SELECT signature FROM signatures WHERE employee_id = $1",
      [employeeIdToUse]
    );
    if (empSig) employee_signature = empSig.signature;
  }

  // Fetch manager signature
  let manager_signature = null;
  if (managerIdToUse) {
    const managerSig = await queryOne(
      "SELECT signature FROM signatures WHERE employee_id = $1",
      [managerIdToUse]
    );
    if (managerSig) manager_signature = managerSig.signature;
  }

  // Fetch HR signature
  let hr_signature = null;
  if (hrIdToUse) {
    const hrSig = await queryOne(
      "SELECT signature FROM signatures WHERE employee_id = $1",
      [hrIdToUse]
    );
    if (hrSig) hr_signature = hrSig.signature;
  }

  const claimDetail = {
    ...claim,
    trips: (trips || []) as Trip[],
    comments: (comments || []) as Comment[],
    ticket,
    manager_signature,
    hr_signature,
    employee_signature,
  } as ClaimDetail;

  return <ClaimDetailView claim={claimDetail} />;
}
