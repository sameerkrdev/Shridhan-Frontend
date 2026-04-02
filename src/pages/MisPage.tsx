import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSingleSelectAsync } from "@/components/ui/searchable-single-select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { Can, hasPermission } from "@/components/Can";
import {
  useDeleteMisAccountMutation,
  useDeleteMisProjectTypeMutation,
  useMisAccountsQuery,
  useMisProjectTypesQuery,
} from "@/hooks/useMisApi";
import { formatDate } from "@/lib/dateFormat";
import { CreateMisProjectTypeDialog } from "@/dialogs/CreateMisProjectTypeDialog";
import { CreateMisAccountDialog } from "@/dialogs/CreateMisAccountDialog";
import { MisDetailDialog } from "@/dialogs/MisDetailDialog";
import { AddMisDepositDialog } from "@/dialogs/AddMisDepositDialog";
import { PayMisInterestDialog } from "@/dialogs/PayMisInterestDialog";
import { ReturnMisPrincipalDialog } from "@/dialogs/ReturnMisPrincipalDialog";
import type { MisAccount, MisProjectType } from "@/lib/misApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

const formatMisCalculation = (projectType: MisProjectType) => {
  if (projectType.calculationMethod === "ANNUAL_INTEREST_RATE") {
    return `Annual Rate (${Number(projectType.annualInterestRate ?? 0).toFixed(2)}%)`;
  }
  return `Monthly Payout / 100 (${Number(projectType.monthlyPayoutAmountPerHundred ?? 0).toFixed(2)})`;
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
type FieldType = "string" | "number" | "date";
type FilterFieldKey =
  | "customer_name"
  | "phone"
  | "plan"
  | "status"
  | "deposit_amount"
  | "monthly_interest"
  | "maturity_date"
  | "start_date";
type SortField = "id" | "customer_name" | "phone" | "deposit_amount" | "monthly_interest" | "maturity_date" | "status";
type SortOrder = "asc" | "desc";
type MisColumnKey =
  | "mis_id"
  | "customer"
  | "phone"
  | "deposit_amount"
  | "monthly_interest"
  | "maturity_date"
  | "status"
  | "actions";

interface FilterRule {
  id: string;
  field: FilterFieldKey;
  operator: FilterOperator;
  value: string;
}

const MIS_COLUMN_VISIBILITY_STORAGE_KEY = "mis.accountsTable.visibleColumns.v1";
const DEFAULT_VISIBLE_MIS_COLUMNS: Record<MisColumnKey, boolean> = {
  mis_id: true,
  customer: true,
  phone: true,
  deposit_amount: true,
  monthly_interest: true,
  maturity_date: true,
  status: true,
  actions: true,
};
const MIS_COLUMN_OPTIONS: Array<{ key: MisColumnKey; label: string }> = [
  { key: "mis_id", label: "MIS Account ID" },
  { key: "customer", label: "Customer" },
  { key: "phone", label: "Phone" },
  { key: "deposit_amount", label: "Deposit Amount" },
  { key: "monthly_interest", label: "Monthly Interest" },
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
const STRING_OPERATORS: FilterOperator[] = ["equals", "not_equals", "contains", "starts_with", "ends_with", "in"];
const NUMBER_DATE_OPERATORS: FilterOperator[] = ["equals", "not_equals", "gt", "lt", "gte", "lte", "in", "between"];
const MIS_FILTER_FIELDS: Array<{
  value: FilterFieldKey;
  label: string;
  type: FieldType;
  accessor: (mis: MisAccount) => string | number;
}> = [
    { value: "customer_name", label: "Customer Name", type: "string", accessor: (mis) => mis.customer.fullName },
    { value: "phone", label: "Phone", type: "string", accessor: (mis) => mis.customer.phone },
    { value: "plan", label: "Plan", type: "string", accessor: (mis) => mis.projectType.name },
    { value: "status", label: "Status", type: "string", accessor: (mis) => mis.status },
    { value: "deposit_amount", label: "Deposit Amount", type: "number", accessor: (mis) => Number(mis.depositAmount) },
    { value: "monthly_interest", label: "Monthly Interest", type: "number", accessor: (mis) => Number(mis.monthlyInterest) },
    { value: "maturity_date", label: "Maturity Date", type: "date", accessor: (mis) => new Date(mis.maturityDate).getTime() },
    { value: "start_date", label: "Start Date", type: "date", accessor: (mis) => new Date(mis.startDate).getTime() },
  ];
const buildDefaultFilter = (): FilterRule => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  field: "customer_name",
  operator: "contains",
  value: "",
});
const getFieldMeta = (fieldKey: FilterFieldKey) => MIS_FILTER_FIELDS.find((field) => field.value === fieldKey);
const getAllowedOperatorsForField = (fieldKey: FilterFieldKey): FilterOperator[] => {
  const fieldMeta = getFieldMeta(fieldKey);
  if (!fieldMeta) return STRING_OPERATORS;
  return fieldMeta.type === "string" ? STRING_OPERATORS : NUMBER_DATE_OPERATORS;
};
const toComparableValue = (rawValue: string, fieldType: FieldType): string | number => {
  if (fieldType === "number") return Number(rawValue);
  if (fieldType === "date") return new Date(rawValue).getTime();
  return rawValue.toLowerCase();
};
const evaluateRule = (mis: MisAccount, rule: FilterRule): boolean => {
  if (!rule.value.trim()) return true;
  const fieldMeta = MIS_FILTER_FIELDS.find((field) => field.value === rule.field);
  if (!fieldMeta) return true;

  const recordValue = fieldMeta.accessor(mis);
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
        const values = right.split(",").map((item) => item.trim()).filter(Boolean);
        return values.includes(left);
      }
      default:
        return false;
    }
  }

  const left = Number(recordValue);
  if (Number.isNaN(left)) return false;

  if (rule.operator === "between") {
    const parts = rawValue.split(",").map((item) => item.trim());
    if (parts.length !== 2) return false;
    const min = toComparableValue(parts[0], fieldType);
    const max = toComparableValue(parts[1], fieldType);
    if (typeof min !== "number" || typeof max !== "number" || Number.isNaN(min) || Number.isNaN(max)) {
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
};

const MisPage = () => {
  const selectedMembership = useAuthSessionStore((state) => state.selectedMembership);
  const permissions = selectedMembership?.permissions ?? [];
  const societyId = selectedMembership?.societyId ?? null;

  const canCreate = hasPermission(permissions, "mis.create");
  const canRead = hasPermission(permissions, "mis.read");
  const canDeposit = hasPermission(permissions, "mis.deposit");
  const canPayInterest = hasPermission(permissions, "mis.pay_interest");
  const canReturnPrincipal = hasPermission(permissions, "mis.return_principal");
  const canRemoveMis = hasPermission(permissions, "mis.remove");
  const canRemoveProjectType = hasPermission(permissions, "mis.remove_project_type");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<SortField>("maturity_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showDeletedProjectTypes, setShowDeletedProjectTypes] = useState(false);
  const [showDeletedAccounts, setShowDeletedAccounts] = useState(false);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [filterLogic, setFilterLogic] = useState<FilterLogic>("AND");
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [draftFilterLogic, setDraftFilterLogic] = useState<FilterLogic>("AND");
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Record<MisColumnKey, boolean>>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_VISIBLE_MIS_COLUMNS };
    const raw = window.localStorage.getItem(MIS_COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISIBLE_MIS_COLUMNS };
    try {
      const parsed = JSON.parse(raw) as Partial<Record<MisColumnKey, unknown>>;
      return {
        mis_id: typeof parsed.mis_id === "boolean" ? parsed.mis_id : DEFAULT_VISIBLE_MIS_COLUMNS.mis_id,
        customer: typeof parsed.customer === "boolean" ? parsed.customer : DEFAULT_VISIBLE_MIS_COLUMNS.customer,
        phone: typeof parsed.phone === "boolean" ? parsed.phone : DEFAULT_VISIBLE_MIS_COLUMNS.phone,
        deposit_amount:
          typeof parsed.deposit_amount === "boolean" ? parsed.deposit_amount : DEFAULT_VISIBLE_MIS_COLUMNS.deposit_amount,
        monthly_interest:
          typeof parsed.monthly_interest === "boolean" ? parsed.monthly_interest : DEFAULT_VISIBLE_MIS_COLUMNS.monthly_interest,
        maturity_date:
          typeof parsed.maturity_date === "boolean" ? parsed.maturity_date : DEFAULT_VISIBLE_MIS_COLUMNS.maturity_date,
        status: typeof parsed.status === "boolean" ? parsed.status : DEFAULT_VISIBLE_MIS_COLUMNS.status,
        actions: typeof parsed.actions === "boolean" ? parsed.actions : DEFAULT_VISIBLE_MIS_COLUMNS.actions,
      };
    } catch {
      return { ...DEFAULT_VISIBLE_MIS_COLUMNS };
    }
  });

  const [isCreateProjectTypeOpen, setIsCreateProjectTypeOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isRecordTransactionOpen, setIsRecordTransactionOpen] = useState(false);
  const [selectedMisId, setSelectedMisId] = useState<string | null>(null);
  const [transactionTarget, setTransactionTarget] = useState<MisAccount | null>(null);
  const [transactionDialog, setTransactionDialog] = useState<"deposit" | "interest" | "principal" | null>(null);
  const [misToDelete, setMisToDelete] = useState<{ id: string; label: string } | null>(null);
  const [projectTypeToDelete, setProjectTypeToDelete] = useState<{ id: string; label: string } | null>(null);

  const deleteMisMutation = useDeleteMisAccountMutation(societyId ?? "");
  const deleteProjectTypeMutation = useDeleteMisProjectTypeMutation(societyId ?? "");

  const { data: projectTypes, isLoading: isProjectTypeLoading } = useMisProjectTypesQuery(societyId, {
    includeArchived: showDeletedProjectTypes,
    includeDeleted: showDeletedProjectTypes,
  });
  const { data: accountsPayload, isLoading: isAccountsLoading } = useMisAccountsQuery(
    societyId,
    {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      includeDeleted: showDeletedAccounts,
    },
  );

  const projectTypeRows = useMemo(() => projectTypes ?? [], [projectTypes]);
  const accountRows = useMemo(() => accountsPayload?.items ?? [], [accountsPayload?.items]);
  const activeProjectTypes = useMemo(
    () => projectTypeRows.filter((projectType) => !projectType.isDeleted && !projectType.isArchived),
    [projectTypeRows],
  );
  const filteredAccountRows = useMemo(() => {
    if (filters.length === 0) return accountRows;
    return accountRows.filter((account) => {
      const evaluations = filters.map((rule) => evaluateRule(account, rule));
      return filterLogic === "AND" ? evaluations.every(Boolean) : evaluations.some(Boolean);
    });
  }, [accountRows, filterLogic, filters]);
  const eligibleTransactionAccounts = useMemo(
    () => accountRows.filter((account) => !account.isDeleted && account.status !== "CLOSED"),
    [accountRows],
  );
  const misTransactionOptions = useMemo(
    () =>
      eligibleTransactionAccounts.map((account) => ({
        value: account.id,
        label: `${account.customer.fullName} - ${account.customer.phone} (${account.id})`,
      })),
    [eligibleTransactionAccounts],
  );
  const [selectedTransactionMisId, setSelectedTransactionMisId] = useState("");
  const [selectedTransactionType, setSelectedTransactionType] = useState<"deposit" | "interest" | "principal">(
    canDeposit ? "deposit" : canPayInterest ? "interest" : "principal",
  );

  const summary = useMemo(
    () => ({
      total: accountsPayload?.total ?? 0,
      totalPages: accountsPayload?.totalPages ?? 1,
    }),
    [accountsPayload?.total, accountsPayload?.totalPages],
  );
  const visibleColumnCount = useMemo(
    () => Math.max(1, Object.values(visibleColumns).filter(Boolean).length),
    [visibleColumns],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MIS_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

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

  const openAdvancedFilterDialog = () => {
    setDraftFilterLogic(filterLogic);
    setDraftFilters(filters.map((rule) => ({ ...rule })));
    setIsAdvancedFilterOpen(true);
  };

  const updateDraftFilter = (id: string, patch: Partial<FilterRule>) => {
    setDraftFilters((prev) => prev.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));
  };

  const handleDraftFieldChange = (id: string, field: FilterFieldKey) => {
    setDraftFilters((prev) =>
      prev.map((filter) => {
        if (filter.id !== id) return filter;
        const allowedOperators = getAllowedOperatorsForField(field);
        return { ...filter, field, operator: allowedOperators[0] ?? "contains", value: "" };
      }),
    );
  };

  const handleDeleteMis = async () => {
    if (!societyId || !misToDelete) return;
    try {
      await deleteMisMutation.mutateAsync(misToDelete.id);
      toast.success("MIS account deleted");
      setMisToDelete(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete MIS account"));
    }
  };

  const handleDeleteProjectType = async () => {
    if (!societyId || !projectTypeToDelete) return;
    try {
      await deleteProjectTypeMutation.mutateAsync(projectTypeToDelete.id);
      toast.success("MIS project type deleted");
      setProjectTypeToDelete(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete MIS project type"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Monthly Interest Scheme
        </h1>
        <p className="text-muted-foreground mt-2">Manage MIS project types, accounts, deposits, and monthly payouts.</p>
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
            <Can action="mis.create">
              <Button type="button" onClick={() => setIsCreateProjectTypeOpen(true)}>
                Create MIS Project Type
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
                <TableHead>Calculation</TableHead>
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
                    No MIS project types found.
                  </TableCell>
                </TableRow>
              ) : (
                projectTypeRows.map((projectType) => (
                  <TableRow key={projectType.id}>
                    <TableCell className="font-medium">{projectType.name}</TableCell>
                    <TableCell>{projectType.duration} months</TableCell>
                    <TableCell>{formatCurrency(projectType.minimumAmount)}</TableCell>
                    <TableCell>{formatMisCalculation(projectType)}</TableCell>
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

      <section className="space-y-2 mt-18">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">MIS Accounts</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={showDeletedAccounts ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDeletedAccounts((prev) => !prev)}
          >
            {showDeletedAccounts ? "Hide Deleted" : "Show Deleted"}
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
              {MIS_COLUMN_OPTIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[column.key]}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => {
                    setVisibleColumns((prev) => {
                      const next = { ...prev, [column.key]: checked === true };
                      const count = Object.values(next).filter(Boolean).length;
                      if (count === 0) return prev;
                      return next;
                    });
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <Input
              className="w-full md:w-[360px]"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by ID, name, phone, amount, status..."
            />
            {(canDeposit || canPayInterest || canReturnPrincipal) ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedTransactionMisId("");
                  setSelectedTransactionType(canDeposit ? "deposit" : canPayInterest ? "interest" : "principal");
                  setIsRecordTransactionOpen(true);
                }}
                disabled={eligibleTransactionAccounts.length === 0}
              >
                Add Transaction
              </Button>
            ) : null}
            <Can action="mis.create">
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setIsCreateAccountOpen(true)}
                disabled={activeProjectTypes.length === 0}
              >
                Create MIS Account
              </Button>
            </Can>
          </div>
        </div>

        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {visibleColumns.mis_id ? (
                  <TableHead>
                    <button type="button" className="group inline-flex items-center" onClick={() => handleSortClick("id")}>
                      MIS ID
                      {renderSortIcon("id")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleColumns.customer ? (
                  <TableHead>
                    <button type="button" className="group inline-flex items-center" onClick={() => handleSortClick("customer_name")}>
                      Customer
                      {renderSortIcon("customer_name")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleColumns.phone ? (
                  <TableHead>
                    <button type="button" className="group inline-flex items-center" onClick={() => handleSortClick("phone")}>
                      Phone
                      {renderSortIcon("phone")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleColumns.deposit_amount ? (
                  <TableHead>
                    <button type="button" className="group inline-flex items-center" onClick={() => handleSortClick("deposit_amount")}>
                      Deposit Amount
                      {renderSortIcon("deposit_amount")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleColumns.monthly_interest ? (
                  <TableHead>
                    <button type="button" className="group inline-flex items-center" onClick={() => handleSortClick("monthly_interest")}>
                      Monthly Interest
                      {renderSortIcon("monthly_interest")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleColumns.maturity_date ? (
                  <TableHead>
                    <button type="button" className="group inline-flex items-center" onClick={() => handleSortClick("maturity_date")}>
                      Maturity Date
                      {renderSortIcon("maturity_date")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleColumns.status ? (
                  <TableHead>
                    <button type="button" className="group inline-flex items-center" onClick={() => handleSortClick("status")}>
                      Status
                      {renderSortIcon("status")}
                    </button>
                  </TableHead>
                ) : null}
                {visibleColumns.actions ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAccountsLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnCount} className="text-center text-muted-foreground">
                    Loading MIS accounts...
                  </TableCell>
                </TableRow>
              ) : accountRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnCount} className="text-center text-muted-foreground">
                    No MIS accounts found.
                  </TableCell>
                </TableRow>
              ) : filteredAccountRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnCount} className="text-center text-muted-foreground">
                    No MIS accounts match the current filters/search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccountRows.map((account) => (
                  <TableRow key={account.id}>
                    {visibleColumns.mis_id ? <TableCell className="font-medium">{account.id}</TableCell> : null}
                    {visibleColumns.customer ? <TableCell className="font-medium">{account.customer.fullName}</TableCell> : null}
                    {visibleColumns.phone ? <TableCell>{account.customer.phone}</TableCell> : null}
                    {visibleColumns.deposit_amount ? <TableCell>{formatCurrency(account.depositAmount)}</TableCell> : null}
                    {visibleColumns.monthly_interest ? <TableCell>{formatCurrency(account.monthlyInterest)}</TableCell> : null}
                    {visibleColumns.maturity_date ? <TableCell>{formatDate(account.maturityDate)}</TableCell> : null}
                    {visibleColumns.status ? (
                      <TableCell>
                        {account.isDeleted ? (
                          <Badge variant="destructive">DELETED</Badge>
                        ) : (
                          <Badge variant={account.status === "ACTIVE" ? "default" : "secondary"}>{account.status}</Badge>
                        )}
                      </TableCell>
                    ) : null}
                    {visibleColumns.actions ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {canRead ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedMisId(account.id)}>
                              View
                            </Button>
                          ) : null}
                          {canRemoveMis ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={account.isDeleted}
                              onClick={() =>
                                setMisToDelete({
                                  id: account.id,
                                  label: `${account.customer.fullName} (${account.id.slice(0, 8)})`,
                                })
                              }
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {filteredAccountRows.length} of {accountRows.length} rows (Total records: {summary.total})
          </p>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
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
            <span className="text-sm text-muted-foreground">
              Page {page} of {summary.totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(summary.totalPages, prev + 1))}
              disabled={page >= summary.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {societyId ? (
        <>
          {canCreate ? (
            <CreateMisProjectTypeDialog
              open={isCreateProjectTypeOpen}
              onOpenChange={setIsCreateProjectTypeOpen}
              societyId={societyId}
            />
          ) : null}
          {canCreate ? (
            <CreateMisAccountDialog
              open={isCreateAccountOpen}
              onOpenChange={setIsCreateAccountOpen}
              societyId={societyId}
              projectTypes={activeProjectTypes}
            />
          ) : null}
          <MisDetailDialog
            open={Boolean(selectedMisId)}
            onOpenChange={(isOpen) => {
              if (!isOpen) setSelectedMisId(null);
            }}
            societyId={societyId}
            misId={selectedMisId}
          />
          {transactionTarget ? (
            <>
              <AddMisDepositDialog
                open={transactionDialog === "deposit"}
                onOpenChange={(isOpen) => {
                  if (!isOpen) setTransactionDialog(null);
                }}
                societyId={societyId}
                misId={transactionTarget.id}
              />
              <PayMisInterestDialog
                open={transactionDialog === "interest"}
                onOpenChange={(isOpen) => {
                  if (!isOpen) setTransactionDialog(null);
                }}
                societyId={societyId}
                misId={transactionTarget.id}
                duration={transactionTarget.projectType.duration}
                monthlyInterest={Number(transactionTarget.monthlyInterest)}
              />
              <ReturnMisPrincipalDialog
                open={transactionDialog === "principal"}
                onOpenChange={(isOpen) => {
                  if (!isOpen) setTransactionDialog(null);
                }}
                societyId={societyId}
                misId={transactionTarget.id}
              />
            </>
          ) : null}
        </>
      ) : null}

      <Dialog open={Boolean(projectTypeToDelete)} onOpenChange={(isOpen) => !isOpen && setProjectTypeToDelete(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Delete MIS Project Type</DialogTitle>
            <DialogDescription>
              This will soft delete the project type. It will not be available for new MIS accounts and will not be
              considered in active selections/calculations, while old linked records remain for history.
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

      <Dialog open={isRecordTransactionOpen} onOpenChange={setIsRecordTransactionOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Record MIS Transaction</DialogTitle>
            <DialogDescription>Select MIS account and transaction type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">MIS Account</span>
              <SearchableSingleSelectAsync
                value={selectedTransactionMisId}
                onChange={setSelectedTransactionMisId}
                options={misTransactionOptions}
                placeholder="Search MIS by id, customer name, phone"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Transaction Type</span>
              <Select
                value={selectedTransactionType}
                onValueChange={(value) => setSelectedTransactionType(value as "deposit" | "interest" | "principal")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canDeposit ? <SelectItem value="deposit">Deposit</SelectItem> : null}
                  {canPayInterest ? <SelectItem value="interest">Pay Interest</SelectItem> : null}
                  {canReturnPrincipal ? <SelectItem value="principal">Return Principal</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRecordTransactionOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedTransactionMisId}
              onClick={() => {
                const selectedAccount = eligibleTransactionAccounts.find(
                  (account) => account.id === selectedTransactionMisId,
                );
                if (!selectedAccount) return;
                setTransactionTarget(selectedAccount);
                setTransactionDialog(selectedTransactionType);
                setIsRecordTransactionOpen(false);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(misToDelete)} onOpenChange={(isOpen) => !isOpen && setMisToDelete(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Delete MIS Account</DialogTitle>
            <DialogDescription>
              This will soft delete the MIS account. It will be hidden from active lists and excluded from normal
              calculations, but can still be viewed later with the "Show Deleted" option.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            MIS: <span className="font-semibold">{misToDelete?.label}</span>
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMisToDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteMis()}
              disabled={deleteMisMutation.isPending}
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
            <DialogDescription>Create custom filter combinations to narrow MIS account rows</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">Match Logic:</span>
                <Select value={draftFilterLogic} onValueChange={(value) => setDraftFilterLogic(value as FilterLogic)}>
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
                {draftFilters.map((filter) => {
                  const [firstBetween = "", secondBetween = ""] = filter.value.split(",").map((part) => part.trim());
                  return (
                    <div key={filter.id} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
                      <Select
                        value={filter.field}
                        onValueChange={(value) => handleDraftFieldChange(filter.id, value as FilterFieldKey)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MIS_FILTER_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateDraftFilter(filter.id, { operator: value as FilterOperator })}
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

                      {(getFieldMeta(filter.field)?.type ?? "string") === "date" && filter.operator === "between" ? (
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
                      ) : (getFieldMeta(filter.field)?.type ?? "string") === "number" && filter.operator === "between" ? (
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
                      ) : (
                        <Input
                          type={(getFieldMeta(filter.field)?.type ?? "string") === "number" ? "number" : "text"}
                          value={filter.value}
                          onChange={(event) => updateDraftFilter(filter.id, { value: event.target.value })}
                          placeholder={filter.operator === "in" ? "e.g. a,b,c" : "Enter value"}
                        />
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDraftFilters((prev) => prev.filter((item) => item.id !== filter.id))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setDraftFilters((prev) => [...prev, buildDefaultFilter()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
          </div>
          <DialogFooter className="flex w-full items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraftFilters([]);
                setDraftFilterLogic("AND");
              }}
            >
              Clear All
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAdvancedFilterOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setFilters(draftFilters.map((rule) => ({ ...rule })));
                  setFilterLogic(draftFilterLogic);
                  setIsAdvancedFilterOpen(false);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MisPage;
