
import { useAuth } from "./authContext";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Redirect to homepage if not authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Allow access for any role except subscriber
  // Subscribers have their own client dashboard, all other roles are staff
  const hasAdminAccess = user.role !== "subscriber";
  
  if (!hasAdminAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
