import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { firestoreDb, isFirebaseConfigured } from "@/lib/firebase";

type NotificationRow = {
  docId: string;
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
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canUseRealtime = Boolean(societyId && membershipId && firestoreDb && isFirebaseConfigured);

  useEffect(() => {
    if (!canUseRealtime || !societyId || !membershipId || !firestoreDb) return;
    const q = query(
      collection(firestoreDb, `societies/${societyId}/notifications`),
      where("targetMembershipId", "==", membershipId),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => {
            const raw = d.data() as Omit<NotificationRow, "docId">;
            return {
              ...raw,
              docId: d.id,
              isRead: raw.isRead ?? Boolean(raw.readAt),
            };
          }),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [canUseRealtime, societyId, membershipId]);

  const unreadCount = useMemo(() => items.filter((i) => !i.isRead).length, [items]);

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
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No notifications.</div>
          ) : (
            items.map((row) => {
              const accountRoute = getAccountRoute(row);
              const label = row.accountLabel ?? row.rdCustomerName ?? "Notification";
              return (
                <div key={row.docId} className={`border-b px-3 py-2 ${row.isRead ? "" : "bg-muted/20"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{label}</p>
                    {!row.isRead ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.notificationType ?? "Notification"} {row.status ? `• ${row.status}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
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

