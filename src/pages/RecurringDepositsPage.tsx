import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { Can, hasPermission } from "@/components/Can";
import {
  useDeleteRdAccountMutation,
  useDeleteRdProjectTypeMutation,
  useRdAccountsQuery,
  useRdProjectTypesQuery,
} from "@/hooks/useRdApi";
import { formatDate } from "@/lib/dateFormat";
import { CreateRdProjectTypeDialog } from "@/dialogs/CreateRdProjectTypeDialog";
import { CreateRdAccountDialog } from "@/dialogs/CreateRdAccountDialog";
import { RdDetailDialog } from "@/dialogs/RdDetailDialog";
import { AddRdTransactionDialog } from "@/dialogs/AddRdTransactionDialog";
import type { RdAccount } from "@/lib/rdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { ActivityHistory } from "@/components/ActivityHistory";

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

type SortField = "id" | "customer_name" | "phone" | "monthly_amount" | "maturity_date" | "status";
type SortOrder = "asc" | "desc";

const RecurringDepositsPage = () => {
  const selectedMembership = useAuthSessionStore((state) => state.selectedMembership);
  const permissions = selectedMembership?.permissions ?? [];
  const societyId = selectedMembership?.societyId ?? null;

  const canRead = hasPermission(permissions, "recurring_deposit.read");
  const canRemoveRd = hasPermission(permissions, "recurring_deposit.remove");
  const canRemoveProjectType = hasPermission(permissions, "recurring_deposit.remove_project_type");
  const canPayRd = hasPermission(permissions, "recurring_deposit.pay");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<SortField>("maturity_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showDeletedProjectTypes, setShowDeletedProjectTypes] = useState(false);
  const [showDeletedAccounts, setShowDeletedAccounts] = useState(false);

  const [isCreateProjectTypeOpen, setIsCreateProjectTypeOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [selectedRdId, setSelectedRdId] = useState<string | null>(null);
  const [isAddRdTransactionOpen, setIsAddRdTransactionOpen] = useState(false);
  const [rdToDelete, setRdToDelete] = useState<{ id: string; label: string } | null>(null);
  const [projectTypeToDelete, setProjectTypeToDelete] = useState<{ id: string; label: string } | null>(null);

  const deleteRdMutation = useDeleteRdAccountMutation(societyId ?? "");
  const deleteProjectTypeMutation = useDeleteRdProjectTypeMutation(societyId ?? "");

  const { data: projectTypes, isLoading: isProjectTypeLoading } = useRdProjectTypesQuery(societyId, {
    includeArchived: showDeletedProjectTypes,
    includeDeleted: showDeletedProjectTypes,
  });
  const { data: accountsPayload, isLoading: isAccountsLoading } = useRdAccountsQuery(societyId, {
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
    includeDeleted: showDeletedAccounts,
  });

  const projectTypeRows = useMemo(() => projectTypes ?? [], [projectTypes]);
  const accountRows = useMemo(() => accountsPayload?.items ?? [], [accountsPayload?.items]);

  const summary = useMemo(
    () => ({
      total: accountsPayload?.total ?? 0,
      totalPages: accountsPayload?.totalPages ?? 1,
    }),
    [accountsPayload?.total, accountsPayload?.totalPages],
  );

  const rdAccountOptions = useMemo(
    () =>
      accountRows.map((account: RdAccount) => ({
        id: account.id,
        label: `${account.customer.fullName} — ${account.customer.phone} (${account.id.slice(0, 8)}…)`,
      })),
    [accountRows],
  );

  const handleSortClick = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortBy === field) {
      return sortOrder === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
    }
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-70" />;
  };

  const handleDeleteRd = async () => {
    if (!societyId || !rdToDelete) return;
    try {
      await deleteRdMutation.mutateAsync(rdToDelete.id);
      toast.success("RD account deleted");
      setRdToDelete(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete RD account"));
    }
  };

  const handleDeleteProjectType = async () => {
    if (!societyId || !projectTypeToDelete) return;
    try {
      await deleteProjectTypeMutation.mutateAsync(projectTypeToDelete.id);
      toast.success("RD project type deleted");
      setProjectTypeToDelete(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete RD project type"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Recurring Deposits
        </h1>
        <p className="text-muted-foreground mt-2">Manage RD project types, monthly installments, fines, and payouts.</p>
      </div>

      <section className="mt-8 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Project Types</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showDeletedProjectTypes ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDeletedProjectTypes((prev) => !prev)}
            >
              {showDeletedProjectTypes ? "Hide Deleted" : "Show Deleted"}
            </Button>
            <Can action="recurring_deposit.create">
              <Button type="button" onClick={() => setIsCreateProjectTypeOpen(true)}>
                Create RD Project Type
              </Button>
            </Can>
          </div>
        </div>

        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Min monthly</TableHead>
                <TableHead>Overdue fee</TableHead>
                <TableHead>Grace days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isProjectTypeLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading project types...
                  </TableCell>
                </TableRow>
              ) : projectTypeRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No RD project types found.
                  </TableCell>
                </TableRow>
              ) : (
                projectTypeRows.map((projectType) => (
                  <TableRow key={projectType.id}>
                    <TableCell className="font-medium">{projectType.name}</TableCell>
                    <TableCell>{projectType.duration} months</TableCell>
                    <TableCell>{formatCurrency(projectType.minimumMonthlyAmount)}</TableCell>
                    <TableCell>
                      {projectType.fineCalculationMethod === "FIXED_PER_STREAK_UNIT"
                        ? `Fixed ${formatCurrency(projectType.fixedOverdueFineAmount ?? 0)}`
                        : `${projectType.fineRatePerHundred} / ₹100`}
                    </TableCell>
                    <TableCell>{projectType.graceDays}</TableCell>
                    <TableCell>
                      {projectType.isDeleted ? (
                        <Badge variant="destructive">DELETED</Badge>
                      ) : projectType.isArchived ? (
                        <Badge variant="secondary">SUSPENDED</Badge>
                      ) : (
                        <Badge variant="outline">ACTIVE</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canRemoveProjectType && !projectType.isDeleted ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setProjectTypeToDelete({ id: projectType.id, label: projectType.name })}
                        >
                          Delete
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Accounts</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={showDeletedAccounts ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDeletedAccounts((prev) => !prev)}
            >
              {showDeletedAccounts ? "Hide Deleted" : "Show Deleted"}
            </Button>
            <Can action="recurring_deposit.create">
              <Button type="button" onClick={() => setIsCreateAccountOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create RD Account
              </Button>
            </Can>
            {canPayRd ? (
              <Button type="button" variant="secondary" onClick={() => setIsAddRdTransactionOpen(true)}>
                Add Transaction
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by name, phone, plan, status..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />
        </div>

        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="group cursor-pointer" onClick={() => handleSortClick("customer_name")}>
                  Customer {renderSortIcon("customer_name")}
                </TableHead>
                <TableHead className="group cursor-pointer" onClick={() => handleSortClick("phone")}>
                  Phone {renderSortIcon("phone")}
                </TableHead>
                <TableHead className="group cursor-pointer" onClick={() => handleSortClick("monthly_amount")}>
                  Monthly {renderSortIcon("monthly_amount")}
                </TableHead>
                <TableHead className="group cursor-pointer" onClick={() => handleSortClick("maturity_date")}>
                  Maturity {renderSortIcon("maturity_date")}
                </TableHead>
                <TableHead className="group cursor-pointer" onClick={() => handleSortClick("status")}>
                  Status {renderSortIcon("status")}
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAccountsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading accounts...
                  </TableCell>
                </TableRow>
              ) : accountRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No RD accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                accountRows.map((account: RdAccount) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.customer.fullName}</TableCell>
                    <TableCell>{account.customer.phone}</TableCell>
                    <TableCell>{formatCurrency(account.monthlyAmount)}</TableCell>
                    <TableCell>{formatDate(account.maturityDate)}</TableCell>
                    <TableCell>
                      <Badge variant={account.status === "ACTIVE" ? "default" : "secondary"}>{account.status}</Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {canRead ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRdId(account.id)}>
                          View
                        </Button>
                      ) : null}
                      {canRemoveRd && !account.isDeleted ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setRdToDelete({ id: account.id, label: account.customer.fullName })}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Page {page} of {summary.totalPages} — {summary.total} accounts
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= summary.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
            <select
              className="border rounded-md px-2 py-1 bg-background"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">Activities</h2>
        <ActivityHistory societyId={societyId ?? ""} entityType="RD_ACCOUNT" entityId={null} title="RD Account Activities" />
        <ActivityHistory societyId={societyId ?? ""} entityType="RD_PROJECT_TYPE" entityId={null} title="RD Project Type Activities" />
      </section>

      {societyId ? (
        <>
          <CreateRdProjectTypeDialog
            open={isCreateProjectTypeOpen}
            onOpenChange={setIsCreateProjectTypeOpen}
            societyId={societyId}
          />
          <CreateRdAccountDialog
            open={isCreateAccountOpen}
            onOpenChange={setIsCreateAccountOpen}
            societyId={societyId}
            projectTypes={projectTypeRows}
          />
          <RdDetailDialog open={Boolean(selectedRdId)} onOpenChange={(o) => !o && setSelectedRdId(null)} societyId={societyId} rdId={selectedRdId} />
          {canPayRd ? (
            <AddRdTransactionDialog
              open={isAddRdTransactionOpen}
              onOpenChange={setIsAddRdTransactionOpen}
              societyId={societyId}
              recurringDepositOptions={rdAccountOptions}
            />
          ) : null}
        </>
      ) : null}

      {projectTypeToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border bg-background p-6 max-w-md space-y-4 shadow-lg">
            <p>
              Delete project type <strong>{projectTypeToDelete.label}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProjectTypeToDelete(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleDeleteProjectType}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rdToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border bg-background p-6 max-w-md space-y-4 shadow-lg">
            <p>
              Delete RD account for <strong>{rdToDelete.label}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRdToDelete(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleDeleteRd}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default RecurringDepositsPage;
