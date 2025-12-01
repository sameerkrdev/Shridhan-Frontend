import { createBrowserRouter } from "react-router";
import RootLayout from "@/layouts/RootLayout";
import AuthorizedLayout from "@/layouts/AuthorizedLayout";
import UnauthorizedLayout from "@/layouts/UnauthorizedLayout";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        path: "",
        element: <AuthorizedLayout />,
        children: [
          {
            path: "",
            element: <DashboardPage />,
          },
        ],
      },
      {
        path: "auth",
        element: <UnauthorizedLayout />,
        children: [
          {
            path: "login",
            element: <LoginPage />,
            children: [],
          },
        ],
      },
    ],
  },
]);

export default router;
