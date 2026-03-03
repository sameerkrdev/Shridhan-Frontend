import { createBrowserRouter } from "react-router";
import RootLayout from "@/layouts/RootLayout";
import AuthorizedLayout from "@/layouts/AuthorizedLayout";
import UnauthorizedLayout from "@/layouts/UnauthorizedLayout";
import DashboardPage from "@/pages/DashboardPage";
import MembersPage from "@/pages/MembersPage";
import RoleSettingsPage from "@/pages/RoleSettingsPage";
import UserProfilePage from "@/pages/UserProfilePage";
import LoginPage from "@/pages/LoginPage";
import IndexPage from "@/pages/IndexPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SignupPage from "@/pages/SignupPage";
import MemberFlowLayout from "@/layouts/MemberFlowLayout";
import SocietySelectorPage from "@/pages/SocietySelectorPage";
import PermitPendingPage from "@/pages/PermitPendingPage";
import RazorpayPendingPage from "@/pages/RazorpayPendingPage";
import SubscriptionStatusPage from "@/pages/SubscriptionStatusPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        element: <AuthorizedLayout />,
        children: [
          { path: "", element: <DashboardPage /> },
          { path: "members", element: <MembersPage /> },
          { path: "role-settings", element: <RoleSettingsPage /> },
          { path: "profile", element: <UserProfilePage /> },
          { path: "billing", element: <SubscriptionStatusPage /> },
        ],
      },
      {
        element: <MemberFlowLayout />,
        children: [
          { path: "society-selector", element: <SocietySelectorPage /> },
          { path: "onboarding", element: <OnboardingPage /> },
          { path: "onboarding/permit", element: <PermitPendingPage /> },
          { path: "onboarding/razorpay", element: <RazorpayPendingPage /> },
        ],
      },
      {
        element: <UnauthorizedLayout />,
        children: [
          { path: "login", element: <LoginPage /> },
          { path: "register", element: <SignupPage /> },
          { path: "index", element: <IndexPage /> },
        ],
      },
    ],
  },
]);

export default router;
