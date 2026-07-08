import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { UserRole } from "@sprintaiso/api-types";
import { useAuth } from "./AuthProvider";
import { LoadingSpinner } from "../components/LoadingSpinner";

interface Props {
  children: ReactNode;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === "CUSTOMER" ? "/deals" : "/admin";
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
