"use client";

import { useState, useEffect, useCallback } from "react";
import { Employee } from "@/types";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeTable } from "@/components/employees/employee-table";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { ImportDialog } from "@/components/employees/import-dialog";
import { Plus, FileUp, Search } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const res = await fetch(`/api/employees?${params}`);
      const result = await res.json();
      if (result.success) {
        setEmployees(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleEdit = (employee: Employee) => {
    setEditEmployee(employee);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditEmployee(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-2 rounded-field"
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="h-4 w-4" />
            Import CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2 rounded-field"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Tambah Employee
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-box border border-base-300 bg-base-100">
        {loading ? (
          <div>
            <div className="border-b border-base-300 px-4 py-3 flex gap-6">
              {[60, 140, 100, 120, 80, 60].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: w }} />
              ))}
            </div>
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="border-b border-base-300 px-4 py-4 flex gap-6 items-center">
                {[60, 140, 100, 120, 80, 60].map((w, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <EmployeeTable
            employees={employees}
            onEdit={handleEdit}
            onRefresh={fetchEmployees}
          />
        )}
      </div>

      {/* Dialogs */}
      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        employee={editEmployee}
        onSuccess={fetchEmployees}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={fetchEmployees}
      />
    </div>
  );
}
