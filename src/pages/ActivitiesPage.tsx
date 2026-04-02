import { useState } from "react";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { hasPermission } from "@/components/Can";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivitiesQuery } from "@/hooks/useActivityApi";
import { formatDate } from "@/lib/dateFormat";

const ActivitiesPage = () => {
  const selectedMembership = useAuthSessionStore((state) => state.selectedMembership);
  const permissions = selectedMembership?.permissions;
  const societyId = selectedMembership?.societyId ?? null;
  const canReadActivities =
    hasPermission(permissions, "activity.list") ||
    hasPermission(permissions, "fixed_deposit.list") ||
    hasPermission(permissions, "mis.list") ||
    hasPermission(permissions, "recurring_deposit.list");

  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<string>("ALL");
  const [actionType, setActionType] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data, isLoading } = useActivitiesQuery(societyId, {
    entityType: entityType === "ALL" ? undefined : (entityType as never),
    actionType: actionType === "ALL" ? undefined : actionType,
    search: search || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    page: 1,
    pageSize: 100,
  });

  if (!canReadActivities) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view activities.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Activities</h1>
        <p className="text-muted-foreground">Audit history with advanced filters.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <Input placeholder="Search actor, role, phone, entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger><SelectValue placeholder="Entity Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Entity Types</SelectItem>
            <SelectItem value="FD_PROJECT_TYPE">FD Project Type</SelectItem>
            <SelectItem value="MIS_PROJECT_TYPE">MIS Project Type</SelectItem>
            <SelectItem value="RD_PROJECT_TYPE">RD Project Type</SelectItem>
            <SelectItem value="FD_ACCOUNT">FD Account</SelectItem>
            <SelectItem value="MIS_ACCOUNT">MIS Account</SelectItem>
            <SelectItem value="RD_ACCOUNT">RD Account</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger><SelectValue placeholder="Action Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            <SelectItem value="CREATED">Created</SelectItem>
            <SelectItem value="UPDATED">Updated</SelectItem>
            <SelectItem value="DELETED">Deleted</SelectItem>
            <SelectItem value="PAYMENT_ADDED">Payment Added</SelectItem>
            <SelectItem value="DEPOSIT_ADDED">Deposit Added</SelectItem>
            <SelectItem value="INTEREST_PAID">Interest Paid</SelectItem>
            <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>
      <Button type="button" variant="outline" onClick={() => {
        setSearch("");
        setEntityType("ALL");
        setActionType("ALL");
        setFromDate("");
        setToDate("");
      }}>Clear Filters</Button>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>When</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>
            ) : (data?.items.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={4}>No activities found.</TableCell></TableRow>
            ) : (
              data?.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                  <TableCell>{item.entityType}</TableCell>
                  <TableCell>{item.actionType}</TableCell>
                  <TableCell>{item.actorName} ({item.actorPhone}) • {item.actorRoleName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ActivitiesPage;
