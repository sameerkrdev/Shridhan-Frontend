import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useFdDetailQuery,
  useFdEarlyPayoutRequestsQuery,
  useProjectTypesQuery,
} from "@/hooks/useFixedDepositApi";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { AddTransactionDialog } from "@/dialogs/AddTransactionDialog";
import { CreateFdAccountDialog } from "@/dialogs/CreateFdAccountDialog";
import { ActivityHistory } from "@/components/ActivityHistory";
interface FdDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  fixedDepositId: string | null;
}

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-sm font-medium wrap-break-word">{value}</p>
  </div>
);

export const FdDetailDialog = ({
  open,
  onOpenChange,
  societyId,
  fixedDepositId,
}: FdDetailDialogProps) => {
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { data, isLoading } = useFdDetailQuery(societyId, fixedDepositId, open);
  const { data: projectTypes = [] } = useProjectTypesQuery(societyId);
  const { data: earlyPayoutRequests = [] } = useFdEarlyPayoutRequestsQuery(
    societyId,
    fixedDepositId,
    open && Boolean(fixedDepositId),
  );

  const totalCredit = (data?.transactions ?? [])
    .filter((transaction) => transaction.type === "CREDIT")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalPayout = (data?.transactions ?? [])
    .filter((transaction) => transaction.type === "PAYOUT")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const principalAmount = Number(data?.principalAmount ?? 0);
  const maturityAmount = Number(data?.maturityAmount ?? 0);
  const pendingCredit = Math.max(0, principalAmount - totalCredit);
  const pendingPayout = Math.max(0, maturityAmount - totalPayout);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto overflow-x-hidden sm:max-w-[1040px]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle>FD Account Details</DialogTitle>
                <DialogDescription>
                  Customer, nominee, plan details, and transaction history.
                </DialogDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(true)}>
                Edit Account
              </Button>
            </div>
          </DialogHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading details...</p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">No data found.</p>
          ) : (
            <div className="min-w-0 space-y-6">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      FD Account
                    </p>
                    <p className="font-semibold">{data.id}</p>
                  </div>
                  <Badge variant={data.status === "ACTIVE" ? "default" : "secondary"}>
                    {data.status}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <InfoItem label="Project Type" value={data.projectType.name} />
                  <InfoItem
                    label="Original principal"
                    value={formatCurrency(data.originalPrincipalAmount ?? data.principalAmount)}
                  />
                  <InfoItem
                    label="Current principal"
                    value={formatCurrency(data.principalAmount)}
                  />
                  <InfoItem
                    label="Original maturity"
                    value={formatCurrency(data.originalMaturityAmount ?? data.maturityAmount)}
                  />
                  <InfoItem label="Current maturity" value={formatCurrency(data.maturityAmount)} />
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
                    <InfoItem label="Total Credit Collected" value={formatCurrency(totalCredit)} />
                    <InfoItem label="Pending Credit" value={formatCurrency(pendingCredit)} />
                    <InfoItem label="Total Payout Done" value={formatCurrency(totalPayout)} />
                    <InfoItem label="Pending Payout" value={formatCurrency(pendingPayout)} />
                  </div>
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
                      <div
                        key={document.id}
                        className="rounded-md border p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium">{document.displayName}</p>
                          <p className="text-xs text-muted-foreground">{document.fileName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="xs" asChild>
                            <a href={document.fileUrl} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </Button>
                          <Button type="button" size="xs" asChild>
                            <a href={document.fileUrl} download={document.fileName}>
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Transactions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => setIsAddTransactionOpen(true)}>
                      Add transaction
                    </Button>
                  </div>
                </div>

                {earlyPayoutRequests.length > 0 ? (
                  <div className="w-full max-w-full overflow-x-auto rounded-md border">
                    <p className="px-3 py-2 text-sm font-medium border-b bg-muted/30">
                      Early payout requests
                    </p>
                    <Table className="min-w-[480px]">
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Created</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Recalc</TableHead>
                          <TableHead>Approval deadline</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {earlyPayoutRequests.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs">
                              {formatDateTime(r.createdAt)}
                            </TableCell>
                            <TableCell>{formatCurrency(r.amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {r.recalculatePrincipalAndMaturity ? "Yes" : "No"}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(r.expiresAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                <div className="w-full max-w-full overflow-x-auto rounded-md border">
                  <Table className="min-w-[520px]">
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="min-w-[120px]">Transaction ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No transactions found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={transaction.type === "CREDIT" ? "default" : "secondary"}
                              >
                                {transaction.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{transaction.paymentMethod ?? "N/A"}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] break-all text-muted-foreground">
                              {transaction.transactionId ?? "N/A"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <ActivityHistory societyId={societyId} entityType="FD_ACCOUNT" entityId={data.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {fixedDepositId ? (
        <>
          <AddTransactionDialog
            open={isAddTransactionOpen}
            onOpenChange={setIsAddTransactionOpen}
            societyId={societyId}
            fixedDepositId={fixedDepositId}
          />
          {data ? (
            <CreateFdAccountDialog
              open={isEditOpen}
              onOpenChange={setIsEditOpen}
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
