import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/claims/status-badge";
import { ClaimWithEmployee } from "@/types";
import dayjs from "dayjs";

interface RecentClaimsTableProps {
  claims: ClaimWithEmployee[];
}

export function RecentClaimsTable({ claims }: RecentClaimsTableProps) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100">
      <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
        <h2 className="text-base font-semibold">Recent Claims</h2>
        <Link
          href="/claims"
          className="btn btn-ghost btn-sm gap-1 rounded-field text-primary"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {claims.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-base-content/50">
          Belum ada data claims.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="text-right">Total Amount</th>
                <th>Status</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-base-200">
                  <td>
                    <Link
                      href={`/claims/${claim.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {claim.employee?.employee_name || "—"}
                    </Link>
                  </td>
                  <td className="text-right font-medium tabular-nums">
                    Rp{claim.total_amount.toLocaleString("id-ID")}
                  </td>
                  <td>
                    <StatusBadge status={claim.status} />
                  </td>
                  <td className="text-base-content/50">
                    {dayjs(claim.updated_at).format("DD MMM YYYY")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
