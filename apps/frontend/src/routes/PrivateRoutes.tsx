import { Navigate, Outlet } from "react-router-dom";
import { useUser } from "../hooks/useUser";

export function PrivateRoute() {
  const { user, loading } = useUser();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
