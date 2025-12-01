import { Outlet } from "react-router";

const UnauthorizedLayout = () => {
  return (
    <div>
      <Outlet />
    </div>
  );
};

export default UnauthorizedLayout;
