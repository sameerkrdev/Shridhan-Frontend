import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRdDetailQuery } from "@/hooks/useRdApi";
import { useRdProjectTypesQuery } from "@/hooks/useRdApi";
import {
  useApproveRdFineWaiveRequestMutation,
  useRdFineWaiveRequestsQuery,
  useRejectRdFineWaiveRequestMutation,
} from "@/hooks/useRdApi";
import { formatDate } from "@/lib/dateFormat";
import { RdPayDialog } from "@/dialogs/RdPayDialog";
import { AddRdTransactionDialog } from "@/dialogs/AddRdTransactionDialog";
import { RdWithdrawDialog } from "@/dialogs/RdWithdrawDialog";
import { CreateRdAccountDialog } from "@/dialogs/CreateRdAccountDialog";
import { hasPermission } from "@/components/Can";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { ActivityHistory } from "@/components/ActivityHistory";

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

interface RdDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  rdId: string | null;
}

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-sm font-medium wrap-break-word">{value}</p>
  </div>
);

export const RdDetailDialog = ({ open, onOpenChange, societyId, rdId }: RdDetailDialogProps) => {
  const [payOpen, setPayOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const permissions = useAuthSessionStore((s) => s.selectedMembership?.permissions ?? []);
  const canPay = hasPermission(permissions, "recurring_deposit.pay");
  const canApproveWaive = hasPermission(permissions, "recurring_deposit.approve_fine_waive");
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const canWithdraw = hasPermission(permissions, "recurring_deposit.withdraw");
  const { data, isLoading } = useRdDetailQuery(societyId, rdId, open);
  const { data: waiveRequests = [] } = useRdFineWaiveRequestsQuery(societyId, rdId, open);
  const approveWaiveMutation = useApproveRdFineWaiveRequestMutation(societyId);
  const rejectWaiveMutation = useRejectRdFineWaiveRequestMutation(societyId);
  const { data: projectTypes = [] } = useRdProjectTypesQuery(societyId, { includeArchived: true });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1040px]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle>RD Account Details</DialogTitle>
                <DialogDescription>Installments, dues, and payment history.</DialogDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                Edit Account
              </Button>
            </div>
          </DialogHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading details...</p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">No data found.</p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">RD Account</p>
                    <p className="font-semibold">{data.id}</p>
                  </div>
                  <Badge variant={data.status === "ACTIVE" ? "default" : "secondary"}>{data.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <InfoItem label="Project Type" value={data.projectType.name} />
                  <InfoItem label="Monthly Amount" value={formatCurrency(data.monthlyAmount)} />
                  <InfoItem
                    label="Expected Maturity Payout"
                    value={formatCurrency(data.summary.expectedMaturityPayout)}
                  />
                  <InfoItem label="Maturity Date" value={formatDate(data.maturityDate)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-4 space-y-4">
                  <h3 className="font-semibold">Customer Details</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem label="Name" value={data.customer.fullName} />
                    <InfoItem label="Phone" value={data.customer.phone} />
                    <InfoItem label="Email" value={data.customer.email ?? "N/A"} />
                    <InfoItem label="Aadhaar" value={data.customer.aadhaar ?? "N/A"} />
                    <InfoItem label="PAN" value={data.customer.pan ?? "N/A"} />
                    <InfoItem label="Address" value={data.customer.address ?? "N/A"} />
                  </div>
                </div>
                <div className="rounded-xl border p-4 space-y-4">
                  <h3 className="font-semibold">Financial Summary</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem label="Total Outstanding" value={formatCurrency(data.summary.totalOutstanding)} />
                    <InfoItem
                      label="Total Principal Expected"
                      value={formatCurrency(data.summary.totalPrincipalExpected)}
                    />
                    <InfoItem label="Deferred Fines" value={formatCurrency(data.summary.totalDeferredFines)} />
                    <InfoItem
                      label="Net Maturity After Fines"
                      value={formatCurrency(data.summary.netMaturityPayoutAfterDeferredFines)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Nominees</h3>
                {data.customer.nominees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No nominees.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.customer.nominees.map((n) => (
                      <div key={n.id} className="rounded-lg border p-3">
                        <p className="font-medium">{n.name}</p>
                        <p className="text-sm text-muted-foreground">{n.phone}</p>
                        <p className="text-sm">{n.relation ?? ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Installments</h3>
                <div className="rounded-md border overflow-auto max-h-[280px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead>Deferred fine</TableHead>
                        <TableHead>Total due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.installments.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.monthIndex}</TableCell>
                          <TableCell>{formatDate(row.dueDate)}</TableCell>
                          <TableCell>{formatCurrency(row.remainingPrincipal)}</TableCell>
                          <TableCell>{formatCurrency(row.fine)}</TableCell>
                          <TableCell>{formatCurrency(row.deferredFineAccrued)}</TableCell>
                          <TableCell>{formatCurrency(row.totalDue)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.computedStatus}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Transactions</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {canPay && data.status === "ACTIVE" ? (
                      <>
                        <Button type="button" onClick={() => setPayOpen(true)}>
                          Pay installment
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setAddTxOpen(true)}>
                          Add transaction
                        </Button>
                      </>
                    ) : null}
                    {canWithdraw && data.status === "ACTIVE" ? (
                      <Button type="button" variant="secondary" onClick={() => setWithdrawOpen(true)}>
                        Withdraw maturity
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-md border overflow-auto max-h-[220px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead>Waived fine</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{tx.type}</TableCell>
                          <TableCell>{formatCurrency(tx.amount)}</TableCell>
                          <TableCell>{formatCurrency(tx.principalAmount)}</TableCell>
                          <TableCell>{formatCurrency(tx.fineAmount)}</TableCell>
                          <TableCell>
                            {formatCurrency(
                              tx.allocations?.reduce((sum, a) => sum + Number(a.waivedFineAmount ?? 0), 0) ?? 0,
                            )}
                          </TableCell>
                          <TableCell>{formatDate(tx.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Fine waive requests</h3>
                <div className="rounded-md border overflow-auto max-h-[220px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Reduce from maturity</TableHead>
                        <TableHead>Months</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waiveRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No fine waive requests.
                          </TableCell>
                        </TableRow>
                      ) : (
                        waiveRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{formatDate(request.createdAt)}</TableCell>
                            <TableCell>{request.status}</TableCell>
                            <TableCell>{request.scopeType}</TableCell>
                            <TableCell>{request.reduceFromMaturity ? "Yes" : "No"}</TableCell>
                            <TableCell>{request.months.map((m) => m.monthIndex).join(", ")}</TableCell>
                            <TableCell className="space-x-2">
                              {canApproveWaive && request.status === "PENDING" ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => approveWaiveMutation.mutate(request.id)}
                                    disabled={approveWaiveMutation.isPending || rejectWaiveMutation.isPending}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      rejectWaiveMutation.mutate({
                                        requestId: request.id,
                                        rejectionReason: "Rejected from RD detail",
                                      })
                                    }
                                    disabled={approveWaiveMutation.isPending || rejectWaiveMutation.isPending}
                                  >
                                    Reject
                                  </Button>
                                </>
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
              </div>
              <ActivityHistory
                societyId={societyId}
                entityType="RD_ACCOUNT"
                entityId={data.id}
              />

            </div>
          )}
        </DialogContent>
      </Dialog>

      {rdId ? (
        <>
          <AddRdTransactionDialog
            open={addTxOpen}
            onOpenChange={setAddTxOpen}
            societyId={societyId}
            recurringDepositId={rdId}
          />
          <RdPayDialog open={payOpen} onOpenChange={setPayOpen} societyId={societyId} rdId={rdId} />
          <RdWithdrawDialog
            open={withdrawOpen}
            onOpenChange={setWithdrawOpen}
            societyId={societyId}
            rdId={rdId}
            summary={data?.summary}
          />
          {data ? (
            <CreateRdAccountDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              societyId={societyId}
              projectTypes={projectTypes}
              mode="edit"
              initialData={data}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
};
