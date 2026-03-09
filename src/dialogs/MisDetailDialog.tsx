import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMisDetailQuery } from "@/hooks/useMisApi";
import { formatDate } from "@/lib/dateFormat";
import { AddMisDepositDialog } from "@/dialogs/AddMisDepositDialog";
import { PayMisInterestDialog } from "@/dialogs/PayMisInterestDialog";
import { ReturnMisPrincipalDialog } from "@/dialogs/ReturnMisPrincipalDialog";

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

interface MisDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  misId: string | null;
}

export const MisDetailDialog = ({ open, onOpenChange, societyId, misId }: MisDetailDialogProps) => {
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isPayInterestOpen, setIsPayInterestOpen] = useState(false);
  const [isReturnPrincipalOpen, setIsReturnPrincipalOpen] = useState(false);
  const { data, isLoading } = useMisDetailQuery(societyId, misId, open);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1040px]">
          <DialogHeader>
            <DialogTitle>MIS Account Details</DialogTitle>
            <DialogDescription>Customer, schedule, payout history, and maturity closure details.</DialogDescription>
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
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">MIS Account</p>
                    <p className="font-semibold">{data.id}</p>
                  </div>
                  <Badge variant={data.status === "ACTIVE" ? "default" : "secondary"}>{data.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Deposit Amount</p>
                    <p className="font-semibold">{formatCurrency(data.depositAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Interest</p>
                    <p className="font-semibold">{formatCurrency(data.monthlyInterest)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Maturity Date</p>
                    <p className="font-semibold">{formatDate(data.maturityDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pending Deposit</p>
                    <p className="font-semibold">{formatCurrency(data.summary.remainingDeposit)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-4 space-y-2">
                  <h3 className="font-semibold">Customer</h3>
                  <p className="text-sm">{data.customer.fullName}</p>
                  <p className="text-sm text-muted-foreground">{data.customer.phone}</p>
                  <p className="text-sm text-muted-foreground">{data.customer.email ?? "N/A"}</p>
                  <p className="text-sm text-muted-foreground">{data.customer.aadhaar ?? "N/A"}</p>
                  <p className="text-sm text-muted-foreground">{data.customer.pan ?? "N/A"}</p>
                </div>
                <div className="rounded-xl border p-4 space-y-2">
                  <h3 className="font-semibold">Summary</h3>
                  <p className="text-sm">Deposit Paid: {formatCurrency(data.summary.depositPaid)}</p>
                  <p className="text-sm">Interest Paid: {formatCurrency(data.summary.interestPaid)}</p>
                  <p className="text-sm">Pending Months: {data.summary.pendingMonths.join(", ") || "None"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Nominees</h3>
                {data.customer.nominees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No nominees added.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.customer.nominees.map((nominee) => (
                      <div key={nominee.id} className="rounded-lg border p-3">
                        <p className="font-medium">{nominee.name}</p>
                        <div className="mt-2 grid gap-2 grid-cols-2 text-sm">
                          <p className="text-muted-foreground">Phone</p>
                          <p>{nominee.phone}</p>
                          <p className="text-muted-foreground">Relation</p>
                          <p>{nominee.relation ?? "N/A"}</p>
                          <p className="text-muted-foreground">Aadhaar</p>
                          <p>{nominee.aadhaar ?? "N/A"}</p>
                          <p className="text-muted-foreground">PAN</p>
                          <p>{nominee.pan ?? "N/A"}</p>
                          <p className="text-muted-foreground">Address</p>
                          <p>{nominee.address ?? "N/A"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">Documents</h3>
                {data.documents?.length ? (
                  <div className="space-y-2">
                    {data.documents.map((document) => (
                      <div key={document.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{document.displayName}</p>
                          <p className="text-xs text-muted-foreground">{document.fileName}</p>
                        </div>
                        <a
                          href={document.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary underline underline-offset-4"
                        >
                          Open
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => setIsDepositOpen(true)}>
                  Add Deposit
                </Button>
                <Button type="button" onClick={() => setIsPayInterestOpen(true)}>
                  Pay Interest
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsReturnPrincipalOpen(true)}
                  disabled={data.status === "CLOSED"}
                >
                  Return Principal
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Transactions</h3>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Date</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Transaction ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No transactions found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                            <TableCell>{transaction.month ?? "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{transaction.type}</Badge>
                            </TableCell>
                            <TableCell>{transaction.isExpected ? "Yes" : "No"}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(transaction.amount)}</TableCell>
                            <TableCell>{transaction.paymentMethod ?? "N/A"}</TableCell>
                            <TableCell>{transaction.transactionId ?? "N/A"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {misId ? (
        <>
          <AddMisDepositDialog open={isDepositOpen} onOpenChange={setIsDepositOpen} societyId={societyId} misId={misId} />
          <PayMisInterestDialog
            open={isPayInterestOpen}
            onOpenChange={setIsPayInterestOpen}
            societyId={societyId}
            misId={misId}
            duration={data?.projectType.duration ?? 1}
            monthlyInterest={Number(data?.monthlyInterest ?? 0)}
          />
          <ReturnMisPrincipalDialog
            open={isReturnPrincipalOpen}
            onOpenChange={setIsReturnPrincipalOpen}
            societyId={societyId}
            misId={misId}
          />
        </>
      ) : null}
    </>
  );
};
