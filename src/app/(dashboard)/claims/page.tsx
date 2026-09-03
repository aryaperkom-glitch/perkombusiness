"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ClaimWithEmployee } from "@/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SendWADialog } from "@/components/claims/send-wa-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/claims/status-badge";
import {
  Search,
  Send,
  Download,
  Loader2,
} from "lucide-react";
import dayjs from "dayjs";

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimWithEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [sendWADialogOpen, setSendWADialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithEmployee | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (periodFilter !== "ALL") params.set("period", periodFilter);

      const res = await fetch(`/api/claims?${params}`);
      const result = await res.json();
      if (result.success) {
        setClaims(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, periodFilter]);

  const fetchPeriods = useCallback(async () => {
    const res = await fetch("/api/claims?distinct_periods=true");
    const result = await res.json();
    if (result.success && result.data) {
      setPeriods(result.data);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleSendWA = (claim: ClaimWithEmployee) => {
    setSelectedClaim(claim);
    setSendWADialogOpen(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (periodFilter !== "ALL") params.set("period", periodFilter);
      window.open(`/api/claims/export?${params}`, "_blank");
    } finally {
      setTimeout(() => setExporting(false), 1500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari claim..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="NEED_REVIEW">Need Review</SelectItem>
              <SelectItem value="UNMATCHED">Unmatched</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Period</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm gap-2 rounded-field"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-box border border-base-300 bg-base-100">
        {loading ? (
          <div>
            {/* Skeleton table header */}
            <div className="border-b border-base-300 px-4 py-3 flex gap-6">
              {[100, 140, 100, 60, 80, 80, 60].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: w }} />
              ))}
            </div>
            {/* Skeleton table rows */}
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="border-b border-base-300 px-4 py-4 flex gap-6 items-center">
                {[100, 140, 100, 60, 80, 80, 60].map((w, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="py-12 text-center text-sm text-base-content/50">
            Belum ada data claims.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm min-w-[1000px]">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Date &amp; Time (GMT+7)</th>
                  <th className="whitespace-nowrap">Employee Name</th>
                  <th className="whitespace-nowrap">Phone</th>
                  <th className="text-center whitespace-nowrap">Trips</th>
                  <th className="text-right whitespace-nowrap">Total Fare</th>
                  <th className="whitespace-nowrap">Mgr Status</th>
                  <th className="whitespace-nowrap">HR Status</th>
                  <th className="whitespace-nowrap">System Status</th>
                  <th className="w-24 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-base-200">
                    <td className="whitespace-nowrap text-xs text-base-content/60">
                      {claim.created_at
                        ? dayjs(claim.created_at).format("DD MMM YYYY, HH:mm")
                        : "—"}
                    </td>
                    <td className="font-medium">
                      {claim.employee?.employee_name || "—"}
                    </td>
                    <td className="text-base-content/60">
                      {claim.employee?.phone_number || "—"}
                    </td>
                    <td className="text-center tabular-nums">
                      {claim.trip_count}
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      IDR {claim.total_amount.toLocaleString("id-ID")}
                    </td>
                    <td>
                      <StatusBadge status={claim.manager_status as any} />
                    </td>
                    <td>
                      <StatusBadge status={claim.hr_status as any} />
                    </td>
                    <td>
                      <StatusBadge status={claim.status} />
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <Link
                          href={`/claims/${claim.id}`}
                          className="btn btn-ghost btn-xs h-7 rounded-field px-2 text-xs"
                        >
                          Detail
                        </Link>
                        {claim.employee &&
                          (claim.status === "PENDING" ||
                            claim.status === "SENT") && (
                            <button
                              type="button"
                              className="btn btn-outline btn-xs h-7 gap-1 rounded-field px-2 text-xs"
                              onClick={() => handleSendWA(claim)}
                            >
                              <Send className="h-3 w-3" />
                              Send
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SendWADialog
        open={sendWADialogOpen}
        onOpenChange={setSendWADialogOpen}
        claim={selectedClaim}
        onSuccess={fetchClaims}
      />
    </div>
  );
}
