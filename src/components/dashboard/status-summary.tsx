const STATUS_ORDER = [
  "PENDING",
  "NEED_REVIEW",
  "SENT",
  "APPROVED",
  "UNMATCHED",
  "MERGED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  NEED_REVIEW: "Need Review",
  SENT: "Sent",
  APPROVED: "Approved",
  UNMATCHED: "Unmatched",
  MERGED: "Merged",
};

interface StatusSummaryProps {
  counts: Record<string, number>;
  total: number;
}

export function StatusSummary({ counts, total }: StatusSummaryProps) {
  const rows = STATUS_ORDER.filter((status) => counts[status] > 0);

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-5">
      <h2 className="text-base font-semibold">Claims by Status</h2>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-base-content/50">
          Belum ada data claims.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((status) => {
            const count = counts[status];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-base-content/70">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="font-medium tabular-nums text-base-content">
                    {count}
                    <span className="ml-1.5 text-xs font-normal text-base-content/40">
                      {pct}%
                    </span>
                  </span>
                </div>
                <progress
                  className="progress mt-1.5 h-1.5"
                  value={count}
                  max={total}
                  aria-label={`${STATUS_LABELS[status] ?? status}: ${count} dari ${total}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
