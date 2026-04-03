import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
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
import { useAuthSessionStore } from "@/store/authSessionStore";
import { hasPermission } from "@/components/Can";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase";

const formatCurrency = (value: string | number) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
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
  createdAt: string;
  updatedAt?: string;
  actedByMembershipId?: string | null;
  isRead?: boolean;
  readAt?: string | null;
};

/** Keyed by society+membership so initial loading resets on remount without setState in the subscription effect. */
const RealtimeNotificationsTable = ({
  societyId,
  membershipId,
  approveMutation,
  rejectMutation,
}: {
  societyId: string;
  membershipId: string;
  approveMutation: ReturnType<typeof useApproveRdFineWaiveRequestMutation>;
  rejectMutation: ReturnType<typeof useRejectRdFineWaiveRequestMutation>;
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [realtimeRequests, setRealtimeRequests] = useState<RealtimeRow[]>([]);
  const [realtimeLoading, setRealtimeLoading] = useState(true);
  const selectedDocId = searchParams.get("docId");

  useEffect(() => {
    if (!firestoreDb) return;
    const q = query(
      collection(firestoreDb, `societies/${societyId}/notifications`),
      where("targetMembershipId", "==", membershipId),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRealtimeRequests(
          snap.docs.map((docSnap) => {
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
              createdAt: string;
              updatedAt?: string;
              actedByMembershipId?: string | null;
              isRead?: boolean;
              readAt?: string | null;
            };
            return { ...d, docId: docSnap.id, isRead: d.isRead ?? Boolean(d.readAt) };
          }),
        );
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
    await updateDoc(doc(firestoreDb, `societies/${societyId}/notifications`, docId), {
      isRead: true,
      readAt: new Date().toISOString(),
    });
  };

  const markAllRealtimeAsRead = async () => {
    const unread = realtimeRequests.filter((r) => !r.isRead);
    if (!unread.length) return;
    await Promise.all(unread.map((r) => markRealtimeAsRead(r.docId)));
  };

  const getAccountRoute = (request: { accountId?: string; routePath?: string; module?: "rd" | "fd" | "mis" }): string | null => {
    if (!request.accountId) return null;
    if (request.routePath) return `${request.routePath}?accountId=${encodeURIComponent(request.accountId)}`;
    if (request.module === "fd") return `/fixed-deposits?accountId=${encodeURIComponent(request.accountId)}`;
    if (request.module === "mis") return `/mis?accountId=${encodeURIComponent(request.accountId)}`;
    return `/recurring-deposits?accountId=${encodeURIComponent(request.accountId)}`;
  };

  const requests = useMemo(
    () =>
      realtimeRequests.map((r) => ({
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
        status: r.status,
        canAct: r.canAct,
        actedByMembershipId: r.actedByMembershipId ?? null,
        isRead: Boolean(r.isRead),
      })),
    [realtimeRequests],
  );
  const unreadCount = requests.filter((r) => !r.isRead).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Unread: <span className="font-medium text-foreground">{unreadCount}</span>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void markAllRealtimeAsRead()}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </Button>
      </div>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Created</TableHead>
              <TableHead>Notification</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Months</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {realtimeLoading ? (
              <TableRow>
                <TableCell colSpan={6}>Loading...</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No pending waive requests.</TableCell>
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
                  <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{request.notificationType}</div>
                    <div className="flex items-center gap-2">
                      {!request.isRead ? (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      ) : null}
                      <span>{request.recurringDeposit.customer.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{request.recurringDeposit.id}</TableCell>
                  <TableCell>
                    {request.months
                      .map((m) => `M${m.monthIndex} (${formatCurrency(m.waivedFineAmount)})`)
                      .join(", ")}
                  </TableCell>
                  <TableCell>{request.status}</TableCell>
                  <TableCell className="space-x-2">
                    {request.notificationType === "RD_FINE_WAIVE_REQUEST" && request.canAct ? (
                      <>
                        <Button
                          size="sm"
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          onClick={() => {
                            void markRealtimeAsRead(request.docId);
                            approveMutation.mutate(request.id);
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          onClick={() => {
                            void markRealtimeAsRead(request.docId);
                            rejectMutation.mutate({
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
                        size="sm"
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
  const canApprove = hasPermission(permissions, "recurring_deposit.approve_fine_waive");
  const useRealtime =
    canApprove && Boolean(societyId && membershipId && firestoreDb && isFirebaseConfigured);
  const { data: fallbackRequests = [], isLoading: isFallbackLoading } =
    usePendingRdFineWaiveRequestsQuery(societyId, canApprove && !useRealtime);
  const approveMutation = useApproveRdFineWaiveRequestMutation(societyId ?? "");
  const rejectMutation = useRejectRdFineWaiveRequestMutation(societyId ?? "");

  const fallbackRequestsWithMeta = useMemo(
    () =>
      fallbackRequests.map((r) => ({
        ...r,
        canAct: r.status === "PENDING",
        actedByMembershipId: null,
        isRead: false,
      })),
    [fallbackRequests],
  );
  const isLoading = !useRealtime && isFallbackLoading;
  const unreadCount = fallbackRequestsWithMeta.filter((r) => !r.isRead).length;

  if (!canApprove) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to review waive requests.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">
          {useRealtime
            ? "Realtime RD fine waive-off notifications (Firestore)."
            : "Pending RD fine waive-off approvals."}
        </p>
      </div>
      {useRealtime && societyId && membershipId && firestoreDb ? (
        <RealtimeNotificationsTable
          key={`${societyId}-${membershipId}`}
          societyId={societyId}
          membershipId={membershipId}
          approveMutation={approveMutation}
          rejectMutation={rejectMutation}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Unread: <span className="font-medium text-foreground">{unreadCount}</span>
            </p>
          </div>
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>Loading...</TableCell>
                  </TableRow>
                ) : fallbackRequestsWithMeta.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No pending waive requests.</TableCell>
                  </TableRow>
                ) : (
                  fallbackRequestsWithMeta.map((request) => (
                    <TableRow key={request.id} className={request.isRead ? "" : "bg-muted/20"}>
                      <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
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
                      <TableCell className="space-x-2">
                        {request.canAct ? (
                          <>
                            <Button
                              size="sm"
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              onClick={() => approveMutation.mutate(request.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              onClick={() =>
                                rejectMutation.mutate({
                                  requestId: request.id,
                                  rejectionReason: "Rejected",
                                })
                              }
                            >
                              Reject
                            </Button>
                          </>
                        ) : request.status === "APPROVED" && request.actedByMembershipId ? (
                          <span className="text-xs text-muted-foreground">
                            Accepted by member {request.actedByMembershipId}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{request.status}</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(`/recurring-deposits?accountId=${encodeURIComponent(request.recurringDeposit.id)}`)
                          }
                        >
                          Go to account
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsPage;
