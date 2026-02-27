import { Navigate, Outlet } from "react-router";
import { getRouteForSocietyStatus } from "@/lib/societyRouting";
import { useAuthSessionStore } from "@/store/authSessionStore";
import FullPageLoader from "@/components/ui/full-page-loader";

const UnauthorizedLayout = () => {
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const isAuthenticated = useAuthSessionStore((state) => state.isAuthenticated);
  const routeIntent = useAuthSessionStore((state) => state.routeIntent);
  const selectedSociety = useAuthSessionStore((state) => state.selectedSociety);

  if (!isHydrated) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    if (routeIntent === "CREATE_NEW_SOCIETY") {
      return <Navigate to="/onboarding" replace />;
    }

    if (!selectedSociety) {
      return <Navigate to="/society-selector" replace />;
    }

    return <Navigate to={getRouteForSocietyStatus(selectedSociety.status)} replace />;
  }

  return (
    <div>
      <Outlet />
    </div>
  );
};

export default UnauthorizedLayout;
