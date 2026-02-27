import { useEffect, useRef } from "react";
import { refreshSession } from "@/lib/authApi";
import { useAuthSessionStore } from "@/store/authSessionStore";

const AuthSessionBootstrap = () => {
  const hasRequestedRefresh = useRef(false);
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const hadSession = useAuthSessionStore((state) => state.hadSession);
  const setAuthPayload = useAuthSessionStore((state) => state.setAuthPayload);
  const clearSession = useAuthSessionStore((state) => state.clearSession);

  useEffect(() => {
    if (!isHydrated || hasRequestedRefresh.current) return;
    if (!hadSession) return;

    hasRequestedRefresh.current = true;
    void refreshSession()
      .then((payload) => {
        setAuthPayload(payload);
      })
      .catch(() => {
        clearSession();
      });
  }, [clearSession, hadSession, isHydrated, setAuthPayload]);

  return null;
};

export default AuthSessionBootstrap;
