import { Outlet } from "react-router";

const AuthorizedLayout = () => {
  return (
    <div>
      <Outlet />
    </div>
  );
};

export default AuthorizedLayout;
