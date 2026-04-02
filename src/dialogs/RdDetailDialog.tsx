import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRdDetailQuery } from "@/hooks/useRdApi";
import { formatDate } from "@/lib/dateFormat";
import { RdPayDialog } from "@/dialogs/RdPayDialog";
import { AddRdTransactionDialog } from "@/dialogs/AddRdTransactionDialog";
import { RdWithdrawDialog } from "@/dialogs/RdWithdrawDialog";
import { hasPermission } from "@/components/Can";
import { useAuthSessionStore } from "@/store/authSessionStore";

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

export const RdDetailDialog = ({ open, onOpenChange, societyId, rdId }: RdDetailDialogProps) => {
  const [payOpen, setPayOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const permissions = useAuthSessionStore((s) => s.selectedMembership?.permissions ?? []);
  const canPay = hasPermission(permissions, "recurring_deposit.pay");
  const [addTxOpen, setAddTxOpen] = useState(false);
  const canWithdraw = hasPermission(permissions, "recurring_deposit.withdraw");
  const { data, isLoading } = useRdDetailQuery(societyId, rdId, open);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1040px]">
          <DialogHeader>
            <DialogTitle>RD Account Details</DialogTitle>
            <DialogDescription>Installments, dues, and payment history.</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading details...</p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">No data found.</p>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">RD Account</p>
                    <p className="font-semibold">{data.id}</p>
                  </div>
                  <Badge variant={data.status === "ACTIVE" ? "default" : "secondary"}>{data.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly amount</p>
                    <p className="font-semibold">{formatCurrency(data.monthlyAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Maturity date</p>
                    <p className="font-semibold">{formatDate(data.maturityDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expected maturity payout</p>
                    <p className="font-semibold">{formatCurrency(data.summary.expectedMaturityPayout)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total outstanding</p>
                    <p className="font-semibold">{formatCurrency(data.summary.totalOutstanding)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deferred fines</p>
                    <p className="font-semibold">{formatCurrency(data.summary.totalDeferredFines)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net maturity after deferred fines</p>
                    <p className="font-semibold">{formatCurrency(data.summary.netMaturityPayoutAfterDeferredFines)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-4 space-y-2">
                  <h3 className="font-semibold">Customer</h3>
                  <p className="text-sm">{data.customer.fullName}</p>
                  <p className="text-sm text-muted-foreground">{data.customer.phone}</p>
                </div>
                <div className="rounded-xl border p-4 space-y-2">
                  <h3 className="font-semibold">Plan</h3>
                  <p className="text-sm">{data.projectType.name}</p>
                  <p className="text-sm text-muted-foreground">{data.projectType.duration} months</p>
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
                <div className="rounded-lg border overflow-auto max-h-[280px]">
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
                <h3 className="font-semibold">Transactions</h3>
                <div className="rounded-lg border overflow-auto max-h-[220px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Fine</TableHead>
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
                          <TableCell>{formatDate(tx.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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
        </>
      ) : null}
    </>
  );
};
