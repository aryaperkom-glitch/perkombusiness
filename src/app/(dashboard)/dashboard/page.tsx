import { query } from "@/lib/db";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RecentClaimsTable } from "@/components/dashboard/recent-claims-table";
import { ClaimsChart, MonthlyClaimsPoint } from "@/components/dashboard/claims-chart";
import { StatusSummary } from "@/components/dashboard/status-summary";
import { DashboardSummary, ClaimWithEmployee } from "@/types";

// Dashboard data is live database state — never prerendered at build time
export const dynamic = "force-dynamic";

function lastSixMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

async function getDashboardData() {
  const [
    employeesRes,
    claimsRes,
    pendingRes,
    approvedRes,
    needReviewRes,
    thisMonthRes,
    monthlyRes,
    statusRes,
    recentClaims,
  ] = await Promise.all([
    query("SELECT count(*)::int AS n FROM employees WHERE is_active = true"),
    query("SELECT count(*)::int AS n FROM claims"),
    query("SELECT count(*)::int AS n FROM claims WHERE status = 'PENDING'"),
    query("SELECT count(*)::int AS n FROM claims WHERE status = 'APPROVED'"),
    query("SELECT count(*)::int AS n FROM claims WHERE status = 'NEED_REVIEW'"),
    query(
      "SELECT count(*)::int AS n FROM claims WHERE created_at >= date_trunc('month', now())"
    ),
    query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS n
       FROM claims
       WHERE created_at >= date_trunc('month', now()) - interval '5 months'
       GROUP BY 1`
    ),
    query("SELECT status, count(*)::int AS n FROM claims GROUP BY status"),
    query(
      `SELECT c.*, to_jsonb(e) AS employee
       FROM claims c
       LEFT JOIN employees e ON c.employee_id = e.id
       ORDER BY c.updated_at DESC
       LIMIT 10`
    ),
  ]);

  const summary: DashboardSummary = {
    total_employees: employeesRes.rows[0].n,
    total_claims: claimsRes.rows[0].n,
    pending_claims: pendingRes.rows[0].n,
    approved_claims: approvedRes.rows[0].n,
    need_review_claims: needReviewRes.rows[0].n,
  };

  const byMonth = new Map(monthlyRes.rows.map((r) => [r.month, r.n]));
  const monthly: MonthlyClaimsPoint[] = lastSixMonths().map((month) => ({
    month,
    count: byMonth.get(month) ?? 0,
  }));

  const statusCounts: Record<string, number> = {};
  for (const row of statusRes.rows) {
    statusCounts[row.status] = row.n;
  }

  return {
    summary,
    claimsThisMonth: thisMonthRes.rows[0].n,
    monthly,
    statusCounts,
    recentClaims: (recentClaims?.rows ?? []) as ClaimWithEmployee[],
  };
}

export default async function DashboardPage() {
  const { summary, claimsThisMonth, monthly, statusCounts, recentClaims } =
    await getDashboardData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-base-content/50">
          Ringkasan klaim transport dan managed service.
        </p>
      </div>

      <SummaryCards summary={summary} claimsThisMonth={claimsThisMonth} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-box border border-base-300 bg-base-100 p-5 lg:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Claims per Month</h2>
            <span className="text-xs text-base-content/50">6 bulan terakhir</span>
          </div>
          <ClaimsChart data={monthly} />
        </div>
        <StatusSummary counts={statusCounts} total={summary.total_claims} />
      </div>

      <RecentClaimsTable claims={recentClaims} />
    </div>
  );
}
