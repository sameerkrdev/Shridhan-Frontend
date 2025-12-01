import { createBrowserRouter } from "react-router";
import RootLayout from "@/layouts/RootLayout";
import AuthorizedLayout from "@/layouts/AuthorizedLayout";
import UnauthorizedLayout from "@/layouts/UnauthorizedLayout";
import DashboardPage from "@/pages/DashboardPage";
import TeamsPage from "@/pages/TeamsPage";
import LoginPage from "@/pages/LoginPage";
import IndexPage from "@/pages/IndexPage";
import OnboardingPage from "@/pages/OnboardingPage";

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
            path: "onboarding",
            element: <OnboardingPage />,
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
