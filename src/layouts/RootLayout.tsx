import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import AuthSessionBootstrap from "@/components/auth/AuthSessionBootstrap";

const RootLayout = () => {
  return (
    <>
      <AuthSessionBootstrap />
      <Outlet />
      <Toaster />
    </>
  );
};

export default RootLayout;
