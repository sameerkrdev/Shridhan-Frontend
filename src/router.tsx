import { createBrowserRouter } from "react-router";
import RootLayout from "@/layouts/RootLayout";
import AuthorizedLayout from "@/layouts/AuthorizedLayout";
import UnauthorizedLayout from "@/layouts/UnauthorizedLayout";
import DashboardPage from "@/pages/DashboardPage";
import TeamsPage from "@/pages/TeamsPage";
import LoginPage from "@/pages/LoginPage";
import IndexPage from "@/pages/IndexPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SignupPage from "@/pages/SignupPage";
import MemberFlowLayout from "@/layouts/MemberFlowLayout";
import SocietySelectorPage from "@/pages/SocietySelectorPage";
import PermitPendingPage from "@/pages/PermitPendingPage";
import RazorpayPendingPage from "@/pages/RazorpayPendingPage";
import PermissionsManagementPage from "@/pages/PermissionsManagementPage";
import RolesManagementPage from "@/pages/RolesManagementPage";
import MemberRoleAssignmentPage from "@/pages/MemberRoleAssignmentPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      // Protected (authenticated) routes
      {
        element: <AuthorizedLayout />,
        children: [
          {
            path: "",
            element: <DashboardPage />,
          },
          {
            path: "teams",
            element: <TeamsPage />,
          },
          {
            path: "settings/permissions",
            element: <PermissionsManagementPage />,
          },
          {
            path: "settings/roles",
            element: <RolesManagementPage />,
          },
          {
            path: "settings/member-roles",
            element: <MemberRoleAssignmentPage />,
          },
        ],
      },
      {
        element: <MemberFlowLayout />,
        children: [
          {
            path: "society-selector",
            element: <SocietySelectorPage />,
          },
          {
            path: "onboarding",
            element: <OnboardingPage />,
          },
          {
            path: "onboarding/permit",
            element: <PermitPendingPage />,
          },
          {
            path: "onboarding/razorpay",
            element: <RazorpayPendingPage />,
          },
        ],
      },

      // Public (unauthenticated) routes
      {
        element: <UnauthorizedLayout />,
        children: [
          {
            path: "login",
            element: <LoginPage />,
          },
          {
            path: "register",
            element: <SignupPage />,
          },
          {
            path: "index", // Todo: For now, we are adding path /index to show the index but when authentication is ready then routing will be based on it.
            element: <IndexPage />,
          },
        ],
      },
    ],
  },
]);

export default router;
