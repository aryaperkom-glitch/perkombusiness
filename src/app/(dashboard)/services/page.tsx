"use client";

import { useState, useMemo, useEffect } from "react";
import { Loader2, RefreshCw, Download, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useRouter } from "next/navigation";

export default function ServicesPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchServiceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchServiceData = async () => {
    setLoading(true);
    setHasFetched(false);
    try {
      const response = await fetch(`/api/services?from=${fromDate}&to=${toDate}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Gagal mengambil data");
      }

      setData(Array.isArray(result.data) ? result.data : [result.data]);
      setHasFetched(true);
      setCurrentPage(1);
      toast.success("Berhasil mengambil data service desk");
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error(error.message || "Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateVal: any) => {
    if (!dateVal) return null;
    let val = dateVal;
    if (/^\d+$/.test(val)) {
      const num = parseInt(val);
      val = num > 9999999999 ? num : num * 1000;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredData = useMemo(() => {
    let filtered = data;

    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(item => {
        const d = parseDate(item.created_at);
        if (!d) return false;
        
        if (dateFilter === "today") {
          return d.toDateString() === now.toDateString();
        }
        if (dateFilter === "week") {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return d >= oneWeekAgo;
        }
        if (dateFilter === "month") {
          const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return d >= oneMonthAgo;
        }
        return true;
      });
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(item => 
        (item.title && item.title.toLowerCase().includes(lowerSearch)) ||
        (item.id && String(item.id).includes(lowerSearch))
      );
    }

    return filtered;
  }, [data, search, dateFilter]);

  // Pagination Logic
  const totalEntries = filteredData.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const downloadCSV = () => {
    if (filteredData.length === 0) {
      toast.error("Tidak ada data untuk di-download");
      return;
    }

    const headers = ["ID", "Subject", "Category ID", "Assigned Help desk ID", "Agent First Name", "Agent Last Name", "Creation date"];
    const rows = filteredData.map(item => {
      const d = parseDate(item.created_at);
      const dateStr = d ? d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "";
      
      return [
        item.id || "",
        `"${(item.title || "").replace(/"/g, '""')}"`,
        item.category_id || "",
        item.assigned_group_id || "",
        item.assigned_id || "",
        "", // Last name (We only have Agent ID for now)
        `"${dateStr}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "requests.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TableHeader = ({ title }: { title: string }) => (
    <th className="whitespace-nowrap bg-base-200 font-semibold text-base-content">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span>{title}</span>
        <ChevronsUpDown className="h-3 w-3 text-base-content/40" />
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-box border border-base-300 bg-base-100 p-3">
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Date filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Date: All</SelectItem>
              <SelectItem value="today">Date: Today</SelectItem>
              <SelectItem value="week">Date: This week</SelectItem>
              <SelectItem value="month">Date: This month</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            className="btn btn-outline btn-sm h-9 rounded-field"
            onClick={downloadCSV}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-base-content">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input input-sm min-w-[120px] rounded-field"
            />
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input input-sm min-w-[120px] rounded-field"
            />
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm h-9 gap-2 rounded-field"
            onClick={fetchServiceData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="rounded-box border border-base-300 bg-base-100">
        <div className="flex flex-col p-4">
          {/* Table Controls */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-base-content">
              <span>Show</span>
              <select
                className="select select-sm rounded-field"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-base-content">
              <span>Search:</span>
              <input
                type="text"
                className="input input-sm w-[180px] rounded-field"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="w-full overflow-x-auto rounded-field border border-base-300">
            <table className="table table-xs min-w-[1200px]">
              <thead>
                <tr>
                  <TableHeader title="ID" />
                  <TableHeader title="Subject" />
                  <TableHeader title="Category" />
                  <TableHeader title="Assigned Help desk" />
                  <TableHeader title="Agent First Name" />
                  <TableHeader title="Agent Last Name" />
                  <TableHeader title="Creation date" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-base-content/60">
                      <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-primary" />
                      Loading...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-base-content/60">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item: any, index: number) => {
                    const d = parseDate(item.created_at);
                    const dateStr = d ? d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '') : "—";

                    return (
                      <tr key={item.id || index} className="hover:bg-base-200">
                        <td className="w-[60px] font-medium text-primary">
                          {item.id || "—"}
                        </td>
                        <td className="font-medium text-primary">
                          {item.title || "—"}
                        </td>
                        <td>
                          {item.category_details?.name || item.category_details?.full_name || (item.category_id ? `Category > ${item.category_id}` : "—")}
                        </td>
                        <td>
                          {item.assigned_group_details?.name || (item.assigned_group_id ? `Helpdesk Level ${item.assigned_group_id}` : "—")}
                        </td>
                        <td>
                          {item.assigned_user?.name || "—"}
                        </td>
                        <td>
                          {item.assigned_user?.lastname || ""}
                        </td>
                        <td className="w-[140px] whitespace-nowrap">
                          {dateStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!loading && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="font-medium text-base-content">
                Showing {totalEntries === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries} entries
              </div>
              <div className="join">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="btn join-item btn-sm rounded-field font-medium text-base-content"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn join-item btn-sm rounded-field font-medium text-base-content"
                >
                  Previous
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`btn join-item btn-sm rounded-field font-medium ${currentPage === pageNum ? 'btn-primary' : 'text-base-content'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn join-item btn-sm rounded-field font-medium text-base-content"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="btn join-item btn-sm rounded-field font-medium text-base-content"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
