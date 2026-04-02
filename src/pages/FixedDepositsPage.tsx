import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthSessionStore } from "@/store/authSessionStore";
import {
  useDeleteProjectTypeMutation,
  useDeleteFdAccountMutation,
  useFdAccountsQuery,
  useProjectTypesQuery,
  useUpdateFdStatusMutation,
} from "@/hooks/useFixedDepositApi";
import { CreateProjectTypeDialog } from "@/dialogs/CreateProjectTypeDialog";
import { CreateFdAccountDialog } from "@/dialogs/CreateFdAccountDialog";
import { FdDetailDialog } from "@/dialogs/FdDetailDialog";
import { AddTransactionDialog } from "@/dialogs/AddTransactionDialog";
import { formatDate } from "@/lib/dateFormat";
import type { FixedDepositAccount, ServiceStatus } from "@/lib/fixedDepositApi";
import { Can, hasPermission } from "@/components/Can";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { ActivityHistory } from "@/components/ActivityHistory";

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

type FilterLogic = "AND" | "OR";
type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "in"
  | "between";

type FilterFieldKey =
  | "customer_name"
  | "phone"
  | "plan"
  | "status"
  | "principal_amount"
  | "maturity_amount"
  | "maturity_date"
  | "start_date";

interface FilterRule {
  id: string;
  field: FilterFieldKey;
  operator: FilterOperator;
  value: string;
}

type FieldType = "string" | "number" | "date";
type SortField =
  | "id"
  | "customer_name"
  | "phone"
  | "plan"
  | "status"
  | "principal_amount"
  | "maturity_amount"
  | "start_date"
  | "maturity_date";
type SortOrder = "asc" | "desc";
type FdColumnKey =
  | "id"
  | "customer"
  | "phone"
  | "plan"
  | "start_date"
  | "maturity_amount"
  | "maturity_date"
  | "status"
  | "actions";

const FD_COLUMN_VISIBILITY_STORAGE_KEY = "fixedDeposits.fdTable.visibleColumns.v1";
const DEFAULT_VISIBLE_FD_COLUMNS: Record<FdColumnKey, boolean> = {
  id: true,
  customer: true,
  phone: true,
  plan: true,
  start_date: true,
  maturity_amount: true,
  maturity_date: true,
  status: true,
  actions: true,
};
const FD_COLUMN_OPTIONS: Array<{ key: FdColumnKey; label: string }> = [
  { key: "id", label: "FD ID" },
  { key: "customer", label: "Customer" },
  { key: "phone", label: "Phone" },
  { key: "plan", label: "Plan" },
  { key: "start_date", label: "Start Date" },
  { key: "maturity_amount", label: "Maturity Amount" },
  { key: "maturity_date", label: "Maturity Date" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
];

const FILTER_OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
  { value: "gte", label: "Greater Than/Equal" },
  { value: "lte", label: "Less Than/Equal" },
  { value: "in", label: "In (comma-separated)" },
  { value: "between", label: "Between (a,b)" },
];

const STRING_OPERATORS: FilterOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "ends_with",
  "in",
];
const NUMBER_DATE_OPERATORS: FilterOperator[] = [
  "equals",
  "not_equals",
  "gt",
  "lt",
  "gte",
  "lte",
  "in",
  "between",
];

const FD_FILTER_FIELDS: Array<{
  value: FilterFieldKey;
  label: string;
  type: FieldType;
  accessor: (fd: FixedDepositAccount) => string | number;
}> = [
  {
    value: "customer_name",
    label: "Customer Name",
    type: "string",
    accessor: (fd) => fd.customer.fullName,
  },
  { value: "phone", label: "Phone", type: "string", accessor: (fd) => fd.customer.phone },
  { value: "plan", label: "Plan", type: "string", accessor: (fd) => fd.projectType.name },
  { value: "status", label: "Status", type: "string", accessor: (fd) => fd.status },
  {
    value: "principal_amount",
    label: "Principal Amount",
    type: "number",
    accessor: (fd) => Number(fd.principalAmount),
  },
  {
    value: "maturity_amount",
    label: "Maturity Amount",
    type: "number",
    accessor: (fd) => Number(fd.maturityAmount),
  },
  {
    value: "maturity_date",
    label: "Maturity Date",
    type: "date",
    accessor: (fd) => new Date(fd.maturityDate).getTime(),
  },
  {
    value: "start_date",
    label: "Start Date",
    type: "date",
    accessor: (fd) => new Date(fd.startDate).getTime(),
  },
];

const buildDefaultFilter = (): FilterRule => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  field: "customer_name",
  operator: "contains",
  value: "",
});

const getFieldMeta = (fieldKey: FilterFieldKey) =>
  FD_FILTER_FIELDS.find((field) => field.value === fieldKey);

const getAllowedOperatorsForField = (fieldKey: FilterFieldKey): FilterOperator[] => {
  const fieldMeta = getFieldMeta(fieldKey);
  if (!fieldMeta) return STRING_OPERATORS;
  return fieldMeta.type === "string" ? STRING_OPERATORS : NUMBER_DATE_OPERATORS;
};

const getDefaultOperatorForField = (fieldKey: FilterFieldKey): FilterOperator => {
  const fieldMeta = getFieldMeta(fieldKey);
  if (!fieldMeta) return "contains";
  return fieldMeta.type === "string" ? "contains" : "equals";
};

const toComparableValue = (rawValue: string, fieldType: FieldType): string | number => {
  if (fieldType === "number") return Number(rawValue);
  if (fieldType === "date") return new Date(rawValue).getTime();
  return rawValue.toLowerCase();
};

const evaluateRule = (fd: FixedDepositAccount, rule: FilterRule): boolean => {
  if (!rule.value.trim()) return true;
  const fieldMeta = FD_FILTER_FIELDS.find((field) => field.value === rule.field);
  if (!fieldMeta) return true;

  const recordValue = fieldMeta.accessor(fd);
  const fieldType = fieldMeta.type;
  const rawValue = rule.value.trim();

  if (fieldType === "string") {
    const left = String(recordValue).toLowerCase();
    const right = rawValue.toLowerCase();

    switch (rule.operator) {
      case "equals":
        return left === right;
      case "not_equals":
        return left !== right;
      case "contains":
        return left.includes(right);
      case "starts_with":
        return left.startsWith(right);
      case "ends_with":
        return left.endsWith(right);
      case "in": {
        const values = right
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        return values.includes(left);
      }
      default:
        return false;
    }
  }

  if (fieldType === "number" || fieldType === "date") {
    const left = Number(recordValue);
    if (Number.isNaN(left)) return false;

    if (rule.operator === "between") {
      const parts = rawValue.split(",").map((item) => item.trim());
      if (parts.length !== 2) return false;
      const min = toComparableValue(parts[0], fieldType);
      const max = toComparableValue(parts[1], fieldType);
      if (
        typeof min !== "number" ||
        typeof max !== "number" ||
        Number.isNaN(min) ||
        Number.isNaN(max)
      ) {
        return false;
      }
      return left >= Math.min(min, max) && left <= Math.max(min, max);
    }

    if (rule.operator === "in") {
      const values = rawValue
        .split(",")
        .map((item) => Number(toComparableValue(item.trim(), fieldType)))
        .filter((item) => !Number.isNaN(item));
      return values.includes(left);
    }

    const right = Number(toComparableValue(rawValue, fieldType));
    if (Number.isNaN(right)) return false;

    switch (rule.operator) {
      case "equals":
        return left === right;
      case "not_equals":
        return left !== right;
      case "gt":
        return left > right;
      case "lt":
        return left < right;
      case "gte":
        return left >= right;
      case "lte":
        return left <= right;
      default:
        return false;
    }
  }

  return true;
};

const FixedDepositsPage = () => {
  const [isProjectTypeDialogOpen, setIsProjectTypeDialogOpen] = useState(false);
  const [isCreateFdDialogOpen, setIsCreateFdDialogOpen] = useState(false);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [selectedFdId, setSelectedFdId] = useState<string | null>(null);
  const [expandedFdIds, setExpandedFdIds] = useState<string[]>([]);
  const [filterLogic, setFilterLogic] = useState<FilterLogic>("AND");
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [draftFilterLogic, setDraftFilterLogic] = useState<FilterLogic>("AND");
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [sortField, setSortField] = useState<SortField>("maturity_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [visibleFdColumns, setVisibleFdColumns] = useState<Record<FdColumnKey, boolean>>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_VISIBLE_FD_COLUMNS };
    const raw = window.localStorage.getItem(FD_COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISIBLE_FD_COLUMNS };
    try {
      const parsed = JSON.parse(raw) as Partial<Record<FdColumnKey, unknown>>;
      return {
        id: typeof parsed.id === "boolean" ? parsed.id : DEFAULT_VISIBLE_FD_COLUMNS.id,
        customer:
          typeof parsed.customer === "boolean"
            ? parsed.customer
            : DEFAULT_VISIBLE_FD_COLUMNS.customer,
        phone: typeof parsed.phone === "boolean" ? parsed.phone : DEFAULT_VISIBLE_FD_COLUMNS.phone,
        plan: typeof parsed.plan === "boolean" ? parsed.plan : DEFAULT_VISIBLE_FD_COLUMNS.plan,
        start_date:
          typeof parsed.start_date === "boolean"
            ? parsed.start_date
            : DEFAULT_VISIBLE_FD_COLUMNS.start_date,
        maturity_amount:
          typeof parsed.maturity_amount === "boolean"
            ? parsed.maturity_amount
            : DEFAULT_VISIBLE_FD_COLUMNS.maturity_amount,
        maturity_date:
          typeof parsed.maturity_date === "boolean"
            ? parsed.maturity_date
            : DEFAULT_VISIBLE_FD_COLUMNS.maturity_date,
        status:
          typeof parsed.status === "boolean" ? parsed.status : DEFAULT_VISIBLE_FD_COLUMNS.status,
        actions:
          typeof parsed.actions === "boolean" ? parsed.actions : DEFAULT_VISIBLE_FD_COLUMNS.actions,
      };
    } catch {
      return { ...DEFAULT_VISIBLE_FD_COLUMNS };
    }
  });
  const [showDeletedProjectTypes, setShowDeletedProjectTypes] = useState(false);
  const [showDeletedFdAccounts, setShowDeletedFdAccounts] = useState(false);
  const [fdToDelete, setFdToDelete] = useState<{ id: string; label: string } | null>(null);
  const [projectTypeToDelete, setProjectTypeToDelete] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const selectedMembership = useAuthSessionStore((state) => state.selectedMembership);
  const societyId = selectedMembership?.societyId ?? null;
  const permissions = selectedMembership?.permissions ?? [];
  const canCreate = hasPermission(permissions, "fixed_deposit.create");
  const canAddTransaction = hasPermission(permissions, "fixed_deposit.add_transaction");
  const canUpdateStatus = hasPermission(permissions, "fixed_deposit.update_status");
  const canRemoveFd = hasPermission(permissions, "fixed_deposit.remove");
  const canRemoveProjectType = hasPermission(permissions, "fixed_deposit.remove_project_type");
  const updateStatusMutation = useUpdateFdStatusMutation(societyId ?? "");
  const deleteProjectTypeMutation = useDeleteProjectTypeMutation(societyId ?? "");
  const deleteFdAccountMutation = useDeleteFdAccountMutation(societyId ?? "");

  const { data: projectTypes, isLoading: isProjectTypesLoading } = useProjectTypesQuery(
    societyId,
    showDeletedProjectTypes,
  );
  const { data: fixedDeposits, isLoading: isFdLoading } = useFdAccountsQuery(
    societyId,
    {
      sortBy: sortField,
      sortOrder,
    },
    showDeletedFdAccounts,
    searchText,
  );

  const projectTypeRows = useMemo(() => projectTypes ?? [], [projectTypes]);
  const activeProjectTypes = useMemo(
    () =>
      projectTypeRows.filter((projectType) => !projectType.isArchived && !projectType.isDeleted),
    [projectTypeRows],
  );
  const fdRows = useMemo(() => fixedDeposits ?? [], [fixedDeposits]);
  const filteredFdRows = useMemo(() => {
    if (filters.length === 0) return fdRows;
    return fdRows.filter((fd) => {
      const evaluations = filters.map((rule) => evaluateRule(fd, rule));
      return filterLogic === "AND" ? evaluations.every(Boolean) : evaluations.some(Boolean);
    });
  }, [fdRows, filterLogic, filters]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFdRows.length / pageSize)),
    [filteredFdRows.length, pageSize],
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedFdRows = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredFdRows.slice(startIndex, startIndex + pageSize);
  }, [filteredFdRows, pageSize, safeCurrentPage]);
  const fdSelectOptions = useMemo(
    () =>
      fdRows.map((fd) => ({
        id: fd.id,
        label: `${fd.customer.fullName} - ${fd.customer.phone} (${fd.id})`,
      })),
    [fdRows],
  );
  const visibleFdColumnCount = useMemo(
    () => Math.max(1, Object.values(visibleFdColumns).filter(Boolean).length),
    [visibleFdColumns],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FD_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleFdColumns));
  }, [visibleFdColumns]);

  const toggleFdExpansion = (fdId: string) => {
    setExpandedFdIds((prev) =>
      prev.includes(fdId) ? prev.filter((id) => id !== fdId) : [...prev, fdId],
    );
  };

  const openAdvancedFilterDialog = () => {
    setDraftFilterLogic(filterLogic);
    setDraftFilters(filters.map((rule) => ({ ...rule })));
    setIsAdvancedFilterOpen(true);
  };

  const updateDraftFilter = (id: string, patch: Partial<FilterRule>) => {
    setDraftFilters((prev) =>
      prev.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)),
    );
  };

  const handleDraftFieldChange = (id: string, field: FilterFieldKey) => {
    setDraftFilters((prev) =>
      prev.map((filter) => {
        if (filter.id !== id) return filter;
        const allowedOperators = getAllowedOperatorsForField(field);
        const nextOperator = allowedOperators[0] ?? getDefaultOperatorForField(field);
        return { ...filter, field, operator: nextOperator, value: "" };
      }),
    );
  };

  const addDraftFilter = () => {
    setDraftFilters((prev) => [...prev, buildDefaultFilter()]);
  };

  const removeDraftFilter = (id: string) => {
    setDraftFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  const clearDraftFilters = () => {
    setDraftFilters([]);
    setDraftFilterLogic("AND");
  };

  const applyDraftFilters = () => {
    setFilters(draftFilters.map((rule) => ({ ...rule })));
    setFilterLogic(draftFilterLogic);
    setCurrentPage(1);
    setIsAdvancedFilterOpen(false);
  };

  const handleStatusChange = async (fdId: string, status: ServiceStatus) => {
    if (!societyId) return;
    try {
      await updateStatusMutation.mutateAsync({ fdId, status });
      toast.success("FD status updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update FD status"));
    }
  };

  const handleDeleteProjectType = async () => {
    if (!societyId) return;
    if (!projectTypeToDelete) return;
    try {
      await deleteProjectTypeMutation.mutateAsync(projectTypeToDelete.id);
      toast.success("Project type deleted");
      setProjectTypeToDelete(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete project type"));
    }
  };

  const handleDeleteFdAccount = async () => {
    if (!societyId) return;
    if (!fdToDelete) return;
    try {
      await deleteFdAccountMutation.mutateAsync(fdToDelete.id);
      toast.success("FD account deleted");
      setFdToDelete(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete FD account"));
    }
  };

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField === field) {
      return sortOrder === "asc" ? (
        <ArrowUp className="ml-1 h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="ml-1 h-3.5 w-3.5" />
      );
    }
    return (
      <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-70" />
    );
  };

  const handleColumnVisibilityChange = (column: FdColumnKey, checked: boolean) => {
    setVisibleFdColumns((prev) => {
      const next = { ...prev, [column]: checked };
      const visibleCount = Object.values(next).filter(Boolean).length;
      if (visibleCount === 0) return prev;
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Fixed Deposits
        </h1>
        <p className="text-muted-foreground mt-2">
          Create fixed deposit plans and manage FD accounts.
        </p>
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
            <Can action="fixed_deposit.create">
              <Button type="button" onClick={() => setIsProjectTypeDialogOpen(true)}>
                Create Project Type
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
                <TableHead>Minimum Amount</TableHead>
                <TableHead>Return Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isProjectTypesLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading project types...
                  </TableCell>
                </TableRow>
              ) : projectTypeRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No project types found.
                  </TableCell>
                </TableRow>
              ) : (
                projectTypeRows.map((projectType) => (
                  <TableRow key={projectType.id}>
                    <TableCell className="font-medium">{projectType.name}</TableCell>
                    <TableCell>{projectType.duration} months</TableCell>
                    <TableCell>{formatCurrency(projectType.minimumAmount)}</TableCell>
                    <TableCell>
                      {projectType.maturityCalculationMethod === "MULTIPLE_OF_PRINCIPAL"
                        ? `${projectType.maturityMultiple}× principal`
                        : `${projectType.maturityAmountPerHundred} per Rs.100`}
                    </TableCell>
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
                          onClick={() =>
                            setProjectTypeToDelete({
                              id: projectType.id,
                              label: projectType.name,
                            })
                          }
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

      <section className="space-y-2 mt-18">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">FD Accounts</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={showDeletedFdAccounts ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDeletedFdAccounts((prev) => !prev)}
          >
            {showDeletedFdAccounts ? "Hide Deleted" : "Show Deleted"}
          </Button>
          <Button type="button" variant="outline" onClick={openAdvancedFilterDialog}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Advanced Filters
            {filters.length > 0 ? (
              <Badge variant="secondary" className="ml-2">
                {filters.length}
              </Badge>
            ) : null}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FD_COLUMN_OPTIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleFdColumns[column.key]}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    handleColumnVisibilityChange(column.key, checked === true)
                  }
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <Input
              className="w-full md:w-[360px]"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by ID, name, phone, amount, date, maturity..."
            />
            <Can action="fixed_deposit.create">
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setIsCreateFdDialogOpen(true)}
                disabled={activeProjectTypes.length === 0}
              >
                Create FD Account
              </Button>
            </Can>
            <Can action="fixed_deposit.add_transaction">
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setIsAddTransactionDialogOpen(true)}
                disabled={(fdRows?.length ?? 0) === 0}
              >
                Add Transaction
              </Button>
            </Can>
          </div>
        </div>
        <div className="rounded-lg border overflow-auto max-h-[540px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/70">
                {visibleFdColumns.id ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("id")}
                    >
                      FD ID
                      {renderSortIcon("id")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.customer ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("customer_name")}
                    >
                      Customer
                      {renderSortIcon("customer_name")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.phone ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("phone")}
                    >
                      Phone
                      {renderSortIcon("phone")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.plan ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("plan")}
                    >
                      Plan
                      {renderSortIcon("plan")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.start_date ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("start_date")}
                    >
                      Start Date
                      {renderSortIcon("start_date")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.maturity_amount ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("maturity_amount")}
                    >
                      Maturity Amount
                      {renderSortIcon("maturity_amount")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.maturity_date ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("maturity_date")}
                    >
                      Maturity Date
                      {renderSortIcon("maturity_date")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.status ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">
                    <button
                      type="button"
                      className="group inline-flex items-center hover:text-foreground"
                      onClick={() => handleSortClick("status")}
                    >
                      Status
                      {renderSortIcon("status")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleFdColumns.actions ? (
                  <TableHead className="sticky top-0 z-10 bg-muted/90">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFdLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleFdColumnCount}
                    className="text-center text-muted-foreground"
                  >
                    Loading FD accounts...
                  </TableCell>
                </TableRow>
              ) : fdRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleFdColumnCount}
                    className="text-center text-muted-foreground"
                  >
                    No fixed deposit accounts found.
                  </TableCell>
                </TableRow>
              ) : filteredFdRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleFdColumnCount}
                    className="text-center text-muted-foreground"
                  >
                    No FD accounts match the current filters/search.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFdRows.map((fd) => (
                  <Fragment key={fd.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => toggleFdExpansion(fd.id)}
                    >
                      {visibleFdColumns.id ? (
                        <TableCell>
                          <button
                            type="button"
                            className="text-primary underline-offset-4 hover:underline font-medium"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedFdId(fd.id);
                            }}
                          >
                            {fd.id.slice(0, 8)}
                          </button>
                        </TableCell>
                      ) : null}
                      {visibleFdColumns.customer ? (
                        <TableCell className="font-medium">{fd.customer.fullName}</TableCell>
                      ) : null}
                      {visibleFdColumns.phone ? <TableCell>{fd.customer.phone}</TableCell> : null}
                      {visibleFdColumns.plan ? <TableCell>{fd.projectType.name}</TableCell> : null}
                      {visibleFdColumns.start_date ? (
                        <TableCell>{formatDate(fd.startDate)}</TableCell>
                      ) : null}
                      {visibleFdColumns.maturity_amount ? (
                        <TableCell>{formatCurrency(fd.maturityAmount)}</TableCell>
                      ) : null}
                      {visibleFdColumns.maturity_date ? (
                        <TableCell>{formatDate(fd.maturityDate)}</TableCell>
                      ) : null}
                      {visibleFdColumns.status ? (
                        <TableCell>
                          {fd.isDeleted ? (
                            <Badge variant="destructive">DELETED</Badge>
                          ) : canUpdateStatus ? (
                            <div onClick={(event) => event.stopPropagation()}>
                              <Select
                                value={fd.status}
                                onValueChange={(value) =>
                                  handleStatusChange(fd.id, value as ServiceStatus)
                                }
                              >
                                <SelectTrigger className="h-8 w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                                  <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Badge variant={fd.status === "ACTIVE" ? "default" : "secondary"}>
                              {fd.status}
                            </Badge>
                          )}
                        </TableCell>
                      ) : null}
                      {visibleFdColumns.actions ? (
                        <TableCell>
                          {canRemoveFd ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setFdToDelete({
                                  id: fd.id,
                                  label: `${fd.customer.fullName} (${fd.id.slice(0, 8)})`,
                                });
                              }}
                              disabled={fd.isDeleted}
                            >
                              Delete
                            </Button>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                    {expandedFdIds.includes(fd.id) ? (
                      <TableRow>
                        <TableCell colSpan={visibleFdColumnCount} className="bg-muted/20">
                          <div className="rounded-md border bg-background overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/40">
                                  <TableHead className="h-9">Date</TableHead>
                                  <TableHead className="h-9">Type</TableHead>
                                  <TableHead className="h-9">Amount</TableHead>
                                  <TableHead className="h-9">Method</TableHead>
                                  <TableHead className="h-9">Transaction ID</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(fd.transactions ?? []).length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={5}
                                      className="text-center text-muted-foreground"
                                    >
                                      No transactions recorded.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  (fd.transactions ?? []).map((transaction) => (
                                    <TableRow key={transaction.id} className="text-sm">
                                      <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                      <TableCell>
                                        <Badge
                                          variant={
                                            transaction.type === "CREDIT" ? "default" : "secondary"
                                          }
                                        >
                                          {transaction.type}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {formatCurrency(transaction.amount)}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">
                                          {transaction.paymentMethod ?? "N/A"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {transaction.transactionId ?? "N/A"}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filteredFdRows.length} of {fdRows.length} FD accounts
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">Activities</h2>
        <ActivityHistory societyId={societyId ?? ""} entityType="FD_ACCOUNT" entityId={null} title="FD Account Activities" />
        <ActivityHistory societyId={societyId ?? ""} entityType="FD_PROJECT_TYPE" entityId={null} title="FD Project Type Activities" />
      </section>

      {societyId ? (
        <>
          {canCreate ? (
            <CreateProjectTypeDialog
              open={isProjectTypeDialogOpen}
              onOpenChange={setIsProjectTypeDialogOpen}
              societyId={societyId}
            />
          ) : null}
          {canCreate ? (
            <CreateFdAccountDialog
              open={isCreateFdDialogOpen}
              onOpenChange={setIsCreateFdDialogOpen}
              societyId={societyId}
              projectTypes={activeProjectTypes}
            />
          ) : null}
          {canAddTransaction ? (
            <AddTransactionDialog
              open={isAddTransactionDialogOpen}
              onOpenChange={setIsAddTransactionDialogOpen}
              societyId={societyId}
              fixedDepositOptions={fdSelectOptions}
            />
          ) : null}
        </>
      ) : null}

      {societyId ? (
        <FdDetailDialog
          open={Boolean(selectedFdId)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedFdId(null);
          }}
          societyId={societyId}
          fixedDepositId={selectedFdId}
        />
      ) : null}

      <Dialog
        open={Boolean(projectTypeToDelete)}
        onOpenChange={(isOpen) => !isOpen && setProjectTypeToDelete(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Delete Project Type</DialogTitle>
            <DialogDescription>
              This will soft delete the project type. It will not be available for new FD accounts
              and will not be considered in future active selections/calculations, while old linked
              records remain for history.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Project Type: <span className="font-semibold">{projectTypeToDelete?.label}</span>
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProjectTypeToDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteProjectType()}
              disabled={deleteProjectTypeMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(fdToDelete)} onOpenChange={(isOpen) => !isOpen && setFdToDelete(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Delete FD Account</DialogTitle>
            <DialogDescription>
              This will soft delete the FD account. It will be hidden from active lists and excluded
              from normal calculations, but can still be viewed later with the "Show Deleted"
              option.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            FD: <span className="font-semibold">{fdToDelete?.label}</span>
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFdToDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteFdAccount()}
              disabled={deleteFdAccountMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
        <DialogContent className="max-w-full sm:max-w-2lg md:max-w-3xl lg:max-w-4xl ">
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
            <DialogDescription>
              Create custom filter combinations to find exactly what you need
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">Match Logic:</span>
                <Select
                  value={draftFilterLogic}
                  onValueChange={(value) => setDraftFilterLogic(value as FilterLogic)}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">All conditions (AND)</SelectItem>
                    <SelectItem value="OR">Any condition (OR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {draftFilters.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                <p className="text-base">No filters added yet</p>
                <p className="text-sm">Click "Add Condition" to start filtering</p>
              </div>
            ) : (
              <div className="space-y-2">
                {draftFilters.map((filter) => (
                  <div key={filter.id} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
                    <Select
                      value={filter.field}
                      onValueChange={(value) =>
                        handleDraftFieldChange(filter.id, value as FilterFieldKey)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FD_FILTER_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filter.operator}
                      onValueChange={(value) =>
                        updateDraftFilter(filter.id, { operator: value as FilterOperator })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPERATORS.filter((operator) =>
                          getAllowedOperatorsForField(filter.field).includes(operator.value),
                        ).map((operator) => (
                          <SelectItem key={operator.value} value={operator.value}>
                            {operator.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(() => {
                      const fieldMeta = getFieldMeta(filter.field);
                      if (!fieldMeta) {
                        return (
                          <Input
                            value={filter.value}
                            onChange={(event) =>
                              updateDraftFilter(filter.id, { value: event.target.value })
                            }
                            placeholder='Value (use "a,b" for between/in)'
                          />
                        );
                      }

                      const [firstBetween = "", secondBetween = ""] = filter.value
                        .split(",")
                        .map((part) => part.trim());

                      if (
                        filter.field === "plan" &&
                        (filter.operator === "equals" || filter.operator === "not_equals")
                      ) {
                        return (
                          <Select
                            value={filter.value}
                            onValueChange={(value) => updateDraftFilter(filter.id, { value })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select project type" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectTypeRows.map((projectType) => (
                                <SelectItem key={projectType.id} value={projectType.name}>
                                  {projectType.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }

                      if (fieldMeta.type === "date") {
                        if (filter.operator === "between") {
                          return (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="date"
                                value={firstBetween}
                                onChange={(event) =>
                                  updateDraftFilter(filter.id, {
                                    value: `${event.target.value},${secondBetween}`,
                                  })
                                }
                              />
                              <Input
                                type="date"
                                value={secondBetween}
                                onChange={(event) =>
                                  updateDraftFilter(filter.id, {
                                    value: `${firstBetween},${event.target.value}`,
                                  })
                                }
                              />
                            </div>
                          );
                        }
                        if (filter.operator === "in") {
                          return (
                            <Input
                              value={filter.value}
                              onChange={(event) =>
                                updateDraftFilter(filter.id, { value: event.target.value })
                              }
                              placeholder="YYYY-MM-DD,YYYY-MM-DD"
                            />
                          );
                        }
                        return (
                          <Input
                            type="date"
                            value={filter.value}
                            onChange={(event) =>
                              updateDraftFilter(filter.id, { value: event.target.value })
                            }
                          />
                        );
                      }

                      if (fieldMeta.type === "number") {
                        if (filter.operator === "between") {
                          return (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                value={firstBetween}
                                onChange={(event) =>
                                  updateDraftFilter(filter.id, {
                                    value: `${event.target.value},${secondBetween}`,
                                  })
                                }
                                placeholder="Min"
                              />
                              <Input
                                type="number"
                                value={secondBetween}
                                onChange={(event) =>
                                  updateDraftFilter(filter.id, {
                                    value: `${firstBetween},${event.target.value}`,
                                  })
                                }
                                placeholder="Max"
                              />
                            </div>
                          );
                        }
                        return (
                          <Input
                            type={filter.operator === "in" ? "text" : "number"}
                            value={filter.value}
                            onChange={(event) =>
                              updateDraftFilter(filter.id, { value: event.target.value })
                            }
                            placeholder={
                              filter.operator === "in" ? "e.g. 10000,25000,50000" : "Enter value"
                            }
                          />
                        );
                      }

                      return (
                        <Input
                          value={filter.value}
                          onChange={(event) =>
                            updateDraftFilter(filter.id, { value: event.target.value })
                          }
                          placeholder={
                            filter.operator === "in" ? "e.g. active,completed" : "Enter value"
                          }
                        />
                      );
                    })()}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDraftFilter(filter.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button type="button" variant="outline" className="w-full" onClick={addDraftFilter}>
              <Plus className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
          </div>
          <DialogFooter className="flex w-full items-center justify-between">
            <Button type="button" variant="ghost" onClick={clearDraftFilters}>
              Clear All
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAdvancedFilterOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={applyDraftFilters}>
                Apply Filters
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixedDepositsPage;
