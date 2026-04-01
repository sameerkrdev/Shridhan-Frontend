import { useEffect, useRef } from "react";
import { fetchSession } from "@/lib/authApi";
import { useAuthSessionStore } from "@/store/authSessionStore";

const AuthSessionBootstrap = () => {
  const hasRequestedRefresh = useRef(false);
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const hadSession = useAuthSessionStore((state) => state.hadSession);
  const hasRestoredSession = useAuthSessionStore((state) => state.hasRestoredSession);
  const setAuthPayload = useAuthSessionStore((state) => state.setAuthPayload);
  const clearSession = useAuthSessionStore((state) => state.clearSession);
  const setHasRestoredSession = useAuthSessionStore((state) => state.setHasRestoredSession);

  useEffect(() => {
    if (!isHydrated || hasRequestedRefresh.current) return;
    if (hasRestoredSession) return;
    if (!hadSession) return;

    hasRequestedRefresh.current = true;
    void fetchSession()
      .then((payload) => {
        setAuthPayload(payload);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setHasRestoredSession(true);
      });
  }, [clearSession, hadSession, hasRestoredSession, isHydrated, setAuthPayload, setHasRestoredSession]);

  return null;
};

export default AuthSessionBootstrap;
