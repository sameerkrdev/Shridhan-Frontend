import { Navigate, Outlet } from "react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getRouteForSocietyStatus } from "@/lib/societyRouting";
import FullPageLoader from "@/components/ui/full-page-loader";

const AuthorizedLayout = () => {
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const isAuthenticated = useAuthSessionStore((state) => state.isAuthenticated);
  const selectedSociety = useAuthSessionStore((state) => state.selectedSociety);

  if (!isHydrated) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!selectedSociety) {
    return <Navigate to="/society-selector" replace />;
  }

  if (selectedSociety.status !== "ACTIVE") {
    return <Navigate to={getRouteForSocietyStatus(selectedSociety.status)} replace />;
  }

  return (
    <div>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* <SectionCards />
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive />
                </div> */}
                {/* <DataTable data={data} /> */}
                <div className="px-4 lg:px-6">
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default AuthorizedLayout;
