import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useApproveRdFineWaiveRequestMutation,
  usePendingRdFineWaiveRequestsQuery,
  useRejectRdFineWaiveRequestMutation,
} from "@/hooks/useRdApi";
import {
  useApproveFdEarlyPayoutRequestMutation,
  usePendingFdEarlyPayoutRequestsQuery,
  useRejectFdEarlyPayoutRequestMutation,
} from "@/hooks/useFixedDepositApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { hasPermission } from "@/components/Can";
import { collection, doc, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { formatDateTime } from "@/lib/dateFormat";
import { toast } from "sonner";

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

const formatNotificationTypeLabel = (value?: string) => {
  if (!value) return "Notification";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

type RealtimeRow = {
  docId: string;
  requestId: string;
  rdId: string;
  rdCustomerName: string;
  notificationType?: string;
  module?: "rd" | "fd" | "mis";
  accountId?: string;
  accountLabel?: string;
  routePath?: string;
  status: string;
  canAct: boolean;
  monthEntries?: Array<{ monthIndex: number; fine: string }>;
  reduceFromMaturity: boolean;
  payoutAmount?: string;
  recalculatePrincipalAndMaturity?: boolean;
  requesterName?: string;
  expiresAt?: string;
  expiresAtDisplay?: string;
  actedByName?: string | null;
  createdAt: string;
  updatedAt?: string;
  actedByMembershipId?: string | null;
  isRead?: boolean;
  readAt?: string | null;
};

const RealtimeNotificationsTable = ({
  societyId,
  membershipId,
  approveRdMutation,
  rejectRdMutation,
  approveFdMutation,
  rejectFdMutation,
  canApproveFd,
  canApproveRd,
}: {
  societyId: string;
  membershipId: string;
  approveRdMutation: ReturnType<typeof useApproveRdFineWaiveRequestMutation>;
  rejectRdMutation: ReturnType<typeof useRejectRdFineWaiveRequestMutation>;
  approveFdMutation: ReturnType<typeof useApproveFdEarlyPayoutRequestMutation>;
  rejectFdMutation: ReturnType<typeof useRejectFdEarlyPayoutRequestMutation>;
  canApproveFd: boolean;
  canApproveRd: boolean;
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [realtimeRequests, setRealtimeRequests] = useState<RealtimeRow[]>([]);
  const [realtimeLoading, setRealtimeLoading] = useState(true);
  const [fdApproveRecalc, setFdApproveRecalc] = useState<Record<string, boolean>>({});
  const selectedDocId = searchParams.get("docId");

  useEffect(() => {
    if (!firestoreDb) return;
    const q = query(
      collection(firestoreDb, `societies/${societyId}/notifications`),
      where("targetMembershipId", "==", membershipId),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => {
          const d = docSnap.data() as {
            requestId: string;
            rdId: string;
            rdCustomerName: string;
            notificationType?: string;
            module?: "rd" | "fd" | "mis";
            accountId?: string;
            accountLabel?: string;
            routePath?: string;
            status: string;
            canAct: boolean;
            monthEntries?: Array<{ monthIndex: number; fine: string }>;
            reduceFromMaturity: boolean;
            payoutAmount?: string;
            recalculatePrincipalAndMaturity?: boolean;
            requesterName?: string;
            expiresAt?: string;
            expiresAtDisplay?: string;
            actedByName?: string | null;
            createdAt: string;
            updatedAt?: string;
            actedByMembershipId?: string | null;
            isRead?: boolean;
            readAt?: string | null;
          };
          return { ...d, docId: docSnap.id, isRead: d.isRead ?? Boolean(d.readAt) };
        });
        rows.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setRealtimeRequests(rows);
        setRealtimeLoading(false);
      },
      () => setRealtimeLoading(false),
    );
    return () => unsub();
  }, [societyId, membershipId]);

  const markRealtimeAsRead = async (docId: string) => {
    if (!firestoreDb) return;
    const row = realtimeRequests.find((r) => r.docId === docId);
    if (!row || row.isRead) return;
    try {
      await updateDoc(doc(firestoreDb, `societies/${societyId}/notifications`, docId), {
        isRead: true,
        readAt: new Date().toISOString(),
      });
    } catch {
      toast.error("Failed to mark notification as read");
    }
  };

  const markAllRealtimeAsRead = async () => {
    const unread = realtimeRequests.filter((r) => !r.isRead);
    if (!unread.length) return;
    try {
      await Promise.all(
        unread.map((row) =>
          updateDoc(doc(firestoreDb!, `societies/${societyId}/notifications`, row.docId), {
            isRead: true,
            readAt: new Date().toISOString(),
          }),
        ),
      );
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all notifications as read");
    }
  };

  const getAccountRoute = (request: {
    accountId?: string;
    routePath?: string;
    module?: "rd" | "fd" | "mis";
  }): string | null => {
    if (!request.accountId) return null;
    if (request.routePath) return `${request.routePath}?accountId=${encodeURIComponent(request.accountId)}`;
    if (request.module === "fd") return `/fixed-deposits?accountId=${encodeURIComponent(request.accountId)}`;
    if (request.module === "mis") return `/mis?accountId=${encodeURIComponent(request.accountId)}`;
    return `/recurring-deposits?accountId=${encodeURIComponent(request.accountId)}`;
  };

  const requests = useMemo(
    () =>
      realtimeRequests
        .filter((r) => {
          if (r.notificationType === "FD_EARLY_PAYOUT_REQUEST" && !canApproveFd) return false;
          if (r.notificationType === "RD_FINE_WAIVE_REQUEST" && !canApproveRd) return false;
          return true;
        })
        .map((r) => ({
        id: r.requestId,
        docId: r.docId,
        createdAt: r.createdAt,
        recurringDeposit: {
          id: r.accountId ?? r.rdId,
          customer: { fullName: r.accountLabel ?? r.rdCustomerName, phone: "—" },
        },
        months: (r.monthEntries ?? []).map((m, idx) => ({
          id: `${r.requestId}-${m.monthIndex}-${idx}`,
          monthIndex: m.monthIndex,
          waivedFineAmount: m.fine,
        })),
        notificationType: r.notificationType ?? "RD_FINE_WAIVE_REQUEST",
        module: r.module ?? "rd",
        routePath: r.routePath,
        accountId: r.accountId ?? r.rdId,
        reduceFromMaturity: r.reduceFromMaturity,
        payoutAmount: r.payoutAmount,
        recalculatePrincipalAndMaturity:
          r.recalculatePrincipalAndMaturity ?? r.reduceFromMaturity,
        requesterName: r.requesterName,
        expiresAt: r.expiresAt,
        expiresAtDisplay: r.expiresAtDisplay,
        actedByName: r.actedByName ?? null,
        status: r.status,
        canAct: r.canAct,
        actedByMembershipId: r.actedByMembershipId ?? null,
        isRead: Boolean(r.isRead),
      })),
    [realtimeRequests, canApproveFd, canApproveRd],
  );
  const unreadCount = requests.filter((r) => !r.isRead).length;

  const actionPending =
    approveRdMutation.isPending ||
    rejectRdMutation.isPending ||
    approveFdMutation.isPending ||
    rejectFdMutation.isPending;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Unread</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {unreadCount}
          </span>
        </div>
        <Button
          size="xs"
          variant="outline"
          onClick={() => void markAllRealtimeAsRead()}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </Button>
      </div>
      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Created</TableHead>
              <TableHead>Notification</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {realtimeLoading ? (
              <TableRow>
                <TableCell colSpan={7}>Loading...</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No notifications.</TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow
                  key={request.docId}
                  className={`${request.isRead ? "" : "bg-muted/20"} ${selectedDocId === request.docId ? "ring-1 ring-blue-500" : ""}`}
                  onClick={() => {
                    void markRealtimeAsRead(request.docId);
                  }}
                >
                  <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      {formatNotificationTypeLabel(request.notificationType)}
                    </div>
                    <div className="flex items-center gap-2">
                      {!request.isRead ? (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      ) : null}
                      <span>{request.recurringDeposit.customer.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{request.recurringDeposit.id}</TableCell>
                  <TableCell>
                    {request.notificationType === "FD_EARLY_PAYOUT_REQUEST" ? (
                      <div className="space-y-2 text-sm">
                        <p>
                          Payout:{" "}
                          <span className="font-medium">
                            {formatCurrency(request.payoutAmount ?? "0")}
                          </span>
                        </p>
                        {request.requesterName ? (
                          <p className="text-xs text-muted-foreground">
                            Requested by: <span className="text-foreground">{request.requesterName}</span>
                          </p>
                        ) : null}
                        {(request.expiresAtDisplay || request.expiresAt) && (
                          <p className="text-xs text-muted-foreground">
                            Approval deadline:{" "}
                            <span className="text-foreground">
                              {request.expiresAtDisplay?.trim() ||
                                formatDateTime(request.expiresAt)}
                            </span>
                          </p>
                        )}
                        {request.status !== "PENDING" && request.actedByName ? (
                          <p className="text-xs text-muted-foreground">
                            Reviewed by:{" "}
                            <span className="text-foreground">{request.actedByName}</span>
                          </p>
                        ) : null}
                        {request.canAct ? (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`fd-recalc-${request.id}`}
                              checked={
                                fdApproveRecalc[request.id] ??
                                Boolean(request.recalculatePrincipalAndMaturity)
                              }
                              onCheckedChange={(c) =>
                                setFdApproveRecalc((prev) => ({
                                  ...prev,
                                  [request.id]: c === true,
                                }))
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label
                              htmlFor={`fd-recalc-${request.id}`}
                              className="text-xs cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Recalculate principal & maturity on approve
                            </label>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Recalculate: {request.recalculatePrincipalAndMaturity ? "Yes" : "No"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm">
                        {request.months
                          .map((m) => `M${m.monthIndex} (${formatCurrency(m.waivedFineAmount)})`)
                          .join(", ") || "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        request.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : request.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : request.status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {request.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {!request.isRead ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => void markRealtimeAsRead(request.docId)}
                      >
                        Mark read
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                    {request.notificationType === "RD_FINE_WAIVE_REQUEST" && canApproveRd && request.canAct ? (
                      <>
                        <Button
                          size="xs"
                          disabled={actionPending}
                          onClick={() => {
                            void markRealtimeAsRead(request.docId);
                            approveRdMutation.mutate(request.id);
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={actionPending}
                          onClick={() => {
                            void markRealtimeAsRead(request.docId);
                            rejectRdMutation.mutate({
                              requestId: request.id,
                              rejectionReason: "Rejected",
                            });
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {request.notificationType === "FD_EARLY_PAYOUT_REQUEST" && canApproveFd && request.canAct ? (
                      <>
                        <Button
                          size="xs"
                          disabled={actionPending}
                          onClick={() => {
                            void markRealtimeAsRead(request.docId);
                            approveFdMutation.mutate({
                              requestId: request.id,
                              recalculatePrincipalAndMaturity:
                                fdApproveRecalc[request.id] ??
                                Boolean(request.recalculatePrincipalAndMaturity),
                            });
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={actionPending}
                          onClick={() => {
                            void markRealtimeAsRead(request.docId);
                            rejectFdMutation.mutate({
                              requestId: request.id,
                              rejectionReason: "Rejected",
                            });
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {getAccountRoute(request) ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          void markRealtimeAsRead(request.docId);
                          const route = getAccountRoute(request);
                          if (route) navigate(route);
                        }}
                      >
                        Go to account
                      </Button>
                    ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const selectedMembership = useAuthSessionStore((s) => s.selectedMembership);
  const societyId = selectedMembership?.societyId ?? null;
  const membershipId = selectedMembership?.membershipId ?? null;
  const permissions = selectedMembership?.permissions ?? [];
  const canApproveRd = hasPermission(permissions, "recurring_deposit.approve_fine_waive");
  const canApproveFd = hasPermission(permissions, "fixed_deposit.approve_early_payout");
  const canReview = canApproveRd || canApproveFd;
  const useRealtime =
    canReview && Boolean(societyId && membershipId && firestoreDb && isFirebaseConfigured);
  const { data: fallbackRd = [], isLoading: isFallbackRdLoading } = usePendingRdFineWaiveRequestsQuery(
    societyId,
    canApproveRd && !useRealtime,
  );
  const { data: fallbackFd = [], isLoading: isFallbackFdLoading } = usePendingFdEarlyPayoutRequestsQuery(
    societyId,
    canApproveFd && !useRealtime,
  );
  const approveRdMutation = useApproveRdFineWaiveRequestMutation(societyId ?? "");
  const rejectRdMutation = useRejectRdFineWaiveRequestMutation(societyId ?? "");
  const approveFdMutation = useApproveFdEarlyPayoutRequestMutation(societyId ?? "");
  const rejectFdMutation = useRejectFdEarlyPayoutRequestMutation(societyId ?? "");
  const [fdFallbackRecalc, setFdFallbackRecalc] = useState<Record<string, boolean>>({});

  const fallbackRdWithMeta = useMemo(
    () =>
      fallbackRd.map((r) => ({
        ...r,
        canAct: r.status === "PENDING",
        actedByMembershipId: null,
        isRead: false,
      })),
    [fallbackRd],
  );

  if (!canReview) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to review notifications.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">
          {useRealtime
            ? "Realtime approval notifications (RD fine waive, FD early payout)."
            : "Pending approvals (API fallback when Firestore is unavailable)."}
        </p>
      </div>
      {useRealtime && societyId && membershipId && firestoreDb ? (
        <RealtimeNotificationsTable
          key={`${societyId}-${membershipId}`}
          societyId={societyId}
          membershipId={membershipId}
          approveRdMutation={approveRdMutation}
          rejectRdMutation={rejectRdMutation}
          approveFdMutation={approveFdMutation}
          rejectFdMutation={rejectFdMutation}
          canApproveFd={canApproveFd}
          canApproveRd={canApproveRd}
        />
      ) : (
        <div className="space-y-8">
          {canApproveRd ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">RD fine waive (pending)</h2>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Created</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>RD ID</TableHead>
                      <TableHead>Months</TableHead>
                      <TableHead>Reduce from maturity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFallbackRdLoading ? (
                      <TableRow>
                        <TableCell colSpan={6}>Loading...</TableCell>
                      </TableRow>
                    ) : fallbackRdWithMeta.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>No pending RD waive requests.</TableCell>
                      </TableRow>
                    ) : (
                      fallbackRdWithMeta.map((request) => (
                        <TableRow key={request.id} className={request.isRead ? "" : "bg-muted/20"}>
                          <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {!request.isRead ? (
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                              ) : null}
                              <span>{request.recurringDeposit.customer.fullName}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {request.recurringDeposit.customer.phone}
                            </div>
                          </TableCell>
                          <TableCell>{request.recurringDeposit.id}</TableCell>
                          <TableCell>
                            {request.months
                              .map((m) => `M${m.monthIndex} (${formatCurrency(m.waivedFineAmount)})`)
                              .join(", ")}
                          </TableCell>
                          <TableCell>{request.reduceFromMaturity ? "Yes" : "No"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                            {request.canAct ? (
                              <>
                                <Button
                                  size="xs"
                                  disabled={approveRdMutation.isPending || rejectRdMutation.isPending}
                                  onClick={() => approveRdMutation.mutate(request.id)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="xs"
                                  variant="destructive"
                                  disabled={approveRdMutation.isPending || rejectRdMutation.isPending}
                                  onClick={() =>
                                    rejectRdMutation.mutate({
                                      requestId: request.id,
                                      rejectionReason: "Rejected",
                                    })
                                  }
                                >
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">{request.status}</span>
                            )}
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `/recurring-deposits?accountId=${encodeURIComponent(request.recurringDeposit.id)}`,
                                )
                              }
                            >
                              Go to account
                            </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {canApproveFd ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">FD early payout (pending)</h2>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Created</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>FD ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Recalculate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFallbackFdLoading ? (
                      <TableRow>
                        <TableCell colSpan={6}>Loading...</TableCell>
                      </TableRow>
                    ) : fallbackFd.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>No pending FD early payout requests.</TableCell>
                      </TableRow>
                    ) : (
                      fallbackFd.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                          <TableCell>
                            <span>{request.fixDeposit.customer.fullName}</span>
                            <div className="text-xs text-muted-foreground">
                              {request.fixDeposit.customer.phone}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Requested by: {request.requestedByDisplayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Approval deadline: {request.expiresAtDisplay}
                            </div>
                          </TableCell>
                          <TableCell>{request.fixDeposit.id}</TableCell>
                          <TableCell>{formatCurrency(request.amount)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`fd-fb-${request.id}`}
                                checked={
                                  fdFallbackRecalc[request.id] ??
                                  request.recalculatePrincipalAndMaturity
                                }
                                onCheckedChange={(c) =>
                                  setFdFallbackRecalc((p) => ({ ...p, [request.id]: c === true }))
                                }
                              />
                              <label htmlFor={`fd-fb-${request.id}`} className="text-xs">
                                On approve
                              </label>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                            <Button
                              size="xs"
                              disabled={approveFdMutation.isPending || rejectFdMutation.isPending}
                              onClick={() =>
                                approveFdMutation.mutate({
                                  requestId: request.id,
                                  recalculatePrincipalAndMaturity:
                                    fdFallbackRecalc[request.id] ??
                                    request.recalculatePrincipalAndMaturity,
                                })
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              size="xs"
                              variant="destructive"
                              disabled={approveFdMutation.isPending || rejectFdMutation.isPending}
                              onClick={() =>
                                rejectFdMutation.mutate({
                                  requestId: request.id,
                                  rejectionReason: "Rejected",
                                })
                              }
                            >
                              Reject
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `/fixed-deposits?accountId=${encodeURIComponent(request.fixDeposit.id)}`,
                                )
                              }
                            >
                              Go to account
                            </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
