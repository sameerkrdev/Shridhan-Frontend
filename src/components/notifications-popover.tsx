import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router";
import { collection, doc, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useApproveFdEarlyPayoutRequestMutation,
  useRejectFdEarlyPayoutRequestMutation,
} from "@/hooks/useFixedDepositApi";
import {
  useApproveRdFineWaiveRequestMutation,
  useRejectRdFineWaiveRequestMutation,
} from "@/hooks/useRdApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { formatDateTime } from "@/lib/dateFormat";
import { hasPermission } from "@/components/Can";

const formatCurrency = (value: string | number | undefined) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Rs. 0.00";
  return `Rs. ${amount.toFixed(2)}`;
};

type NotificationRow = {
  docId: string;
  requestId?: string;
  status?: string;
  notificationType?: string;
  module?: "rd" | "fd" | "mis";
  routePath?: string;
  accountId?: string;
  accountLabel?: string;
  rdCustomerName?: string;
  createdAt?: string;
  readAt?: string | null;
  isRead?: boolean;
  canAct?: boolean;
  payoutAmount?: string;
  recalculatePrincipalAndMaturity?: boolean;
  requesterName?: string;
  expiresAt?: string;
  expiresAtDisplay?: string;
  actedByName?: string | null;
};

const getAccountRoute = (row: NotificationRow): string | null => {
  if (!row.accountId) return null;
  if (row.routePath) return `${row.routePath}?accountId=${encodeURIComponent(row.accountId)}`;
  if (row.module === "fd") return `/fixed-deposits?accountId=${encodeURIComponent(row.accountId)}`;
  if (row.module === "mis") return `/mis?accountId=${encodeURIComponent(row.accountId)}`;
  if (row.module === "rd") return `/recurring-deposits?accountId=${encodeURIComponent(row.accountId)}`;
  return null;
};

export const NotificationsPopover = () => {
  const navigate = useNavigate();
  const selectedMembership = useAuthSessionStore((s) => s.selectedMembership);
  const societyId = selectedMembership?.societyId ?? null;
  const membershipId = selectedMembership?.membershipId ?? null;
  const permissions = selectedMembership?.permissions ?? [];
  const canApproveFd = hasPermission(permissions, "fixed_deposit.approve_early_payout");
  const canApproveRd = hasPermission(permissions, "recurring_deposit.approve_fine_waive");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fdApproveRecalc, setFdApproveRecalc] = useState<Record<string, boolean>>({});

  const societyIdForApi = societyId ?? "";
  const approveRdMutation = useApproveRdFineWaiveRequestMutation(societyIdForApi);
  const rejectRdMutation = useRejectRdFineWaiveRequestMutation(societyIdForApi);
  const approveFdMutation = useApproveFdEarlyPayoutRequestMutation(societyIdForApi);
  const rejectFdMutation = useRejectFdEarlyPayoutRequestMutation(societyIdForApi);

  const actionPending =
    approveRdMutation.isPending ||
    rejectRdMutation.isPending ||
    approveFdMutation.isPending ||
    rejectFdMutation.isPending;

  const canUseRealtime = Boolean(societyId && membershipId && firestoreDb && isFirebaseConfigured);

  useEffect(() => {
    if (!canUseRealtime || !societyId || !membershipId || !firestoreDb) return;
    const q = query(
      collection(firestoreDb, `societies/${societyId}/notifications`),
      where("targetMembershipId", "==", membershipId),
      limit(80),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const raw = d.data() as Omit<NotificationRow, "docId">;
          return {
            ...raw,
            docId: d.id,
            isRead: raw.isRead ?? Boolean(raw.readAt),
            canAct: raw.canAct ?? false,
          };
        });
        next.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
        setItems(next.slice(0, 20));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [canUseRealtime, societyId, membershipId]);

  const visibleItems = useMemo(
    () =>
      items.filter((row) => {
        if (row.notificationType === "FD_EARLY_PAYOUT_REQUEST" && !canApproveFd) return false;
        if (row.notificationType === "RD_FINE_WAIVE_REQUEST" && !canApproveRd) return false;
        return true;
      }),
    [items, canApproveFd, canApproveRd],
  );

  const unreadCount = useMemo(() => visibleItems.filter((i) => !i.isRead).length, [visibleItems]);

  const markAsRead = async (docId: string) => {
    if (!societyId || !firestoreDb) return;
    const row = items.find((i) => i.docId === docId);
    if (!row || row.isRead) return;
    await updateDoc(doc(firestoreDb, `societies/${societyId}/notifications`, docId), {
      isRead: true,
      readAt: new Date().toISOString(),
    });
  };

  if (!canUseRealtime) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-blue-600 px-1 text-[10px] text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b px-3 py-2 text-sm font-semibold">Notifications</div>
        <div className="max-h-[420px] overflow-auto">
          {loading ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Loading...</div>
          ) : visibleItems.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No notifications.</div>
          ) : (
            visibleItems.map((row) => {
              const accountRoute = getAccountRoute(row);
              const label = row.accountLabel ?? row.rdCustomerName ?? "Notification";
              const requestId = row.requestId;
              const showFdActions =
                canApproveFd &&
                row.canAct &&
                row.notificationType === "FD_EARLY_PAYOUT_REQUEST" &&
                Boolean(requestId);
              const showRdActions =
                canApproveRd &&
                row.canAct &&
                row.notificationType === "RD_FINE_WAIVE_REQUEST" &&
                Boolean(requestId);
              return (
                <div key={row.docId} className={`border-b px-3 py-2 ${row.isRead ? "" : "bg-muted/20"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{label}</p>
                    {!row.isRead ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.notificationType ?? "Notification"} {row.status ? `• ${row.status}` : ""}
                    {row.createdAt ? ` • ${formatDateTime(row.createdAt)}` : ""}
                  </p>
                  {row.notificationType === "FD_EARLY_PAYOUT_REQUEST" ? (
                    <p className="text-xs text-muted-foreground">
                      Amount:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(row.payoutAmount)}
                      </span>
                    </p>
                  ) : null}
                  {row.notificationType === "FD_EARLY_PAYOUT_REQUEST" && row.requesterName ? (
                    <p className="text-xs text-muted-foreground">
                      Requested by: <span className="text-foreground">{row.requesterName}</span>
                    </p>
                  ) : null}
                  {row.notificationType === "FD_EARLY_PAYOUT_REQUEST" &&
                  (row.expiresAtDisplay || row.expiresAt) ? (
                    <p className="text-xs text-muted-foreground">
                      Approval deadline:{" "}
                      <span className="text-foreground">
                        {row.expiresAtDisplay?.trim() || formatDateTime(row.expiresAt)}
                      </span>
                    </p>
                  ) : null}
                  {row.notificationType === "FD_EARLY_PAYOUT_REQUEST" &&
                  row.status &&
                  row.status !== "PENDING" &&
                  row.actedByName ? (
                    <p className="text-xs text-muted-foreground">
                      Reviewed by: <span className="text-foreground">{row.actedByName}</span>
                    </p>
                  ) : null}
                  {showFdActions && requestId ? (
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Checkbox
                        id={`popover-fd-recalc-${row.docId}`}
                        checked={
                          fdApproveRecalc[requestId] ?? Boolean(row.recalculatePrincipalAndMaturity)
                        }
                        onCheckedChange={(c) =>
                          setFdApproveRecalc((prev) => ({ ...prev, [requestId]: c === true }))
                        }
                      />
                      <label htmlFor={`popover-fd-recalc-${row.docId}`} className="cursor-pointer">
                        Recalculate principal
                      </label>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void markAsRead(row.docId);
                        navigate(`/notifications?docId=${encodeURIComponent(row.docId)}`);
                      }}
                    >
                      Open
                    </Button>
                    {accountRoute ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void markAsRead(row.docId);
                          navigate(accountRoute);
                        }}
                      >
                        Go to account
                      </Button>
                    ) : null}
                    {showRdActions && requestId ? (
                      <>
                        <Button
                          size="sm"
                          disabled={actionPending}
                          onClick={() => {
                            void markAsRead(row.docId);
                            approveRdMutation.mutate(requestId);
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={actionPending}
                          onClick={() => {
                            void markAsRead(row.docId);
                            rejectRdMutation.mutate({
                              requestId,
                              rejectionReason: "Rejected",
                            });
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {showFdActions && requestId ? (
                      <>
                        <Button
                          size="sm"
                          disabled={actionPending}
                          onClick={() => {
                            void markAsRead(row.docId);
                            approveFdMutation.mutate({
                              requestId,
                              recalculatePrincipalAndMaturity:
                                fdApproveRecalc[requestId] ??
                                Boolean(row.recalculatePrincipalAndMaturity),
                            });
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={actionPending}
                          onClick={() => {
                            void markAsRead(row.docId);
                            rejectFdMutation.mutate({
                              requestId,
                              rejectionReason: "Rejected",
                            });
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" className="w-full" onClick={() => navigate("/notifications")}>
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

