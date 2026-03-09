import { Navigate, Outlet } from "react-router";
import { useAuthSessionStore } from "@/store/authSessionStore";
import FullPageLoader from "@/components/ui/full-page-loader";

const MemberFlowLayout = () => {
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const isAuthenticated = useAuthSessionStore((state) => state.isAuthenticated);
  const hadSession = useAuthSessionStore((state) => state.hadSession);
  const hasRestoredSession = useAuthSessionStore((state) => state.hasRestoredSession);

  const isSessionRestorePending = hadSession && !hasRestoredSession;

  if (!isHydrated || isSessionRestorePending) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default MemberFlowLayout;
