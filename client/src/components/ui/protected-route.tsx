

import { useAuth } from "./authContext";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  redirectAdminsToAdmin?: boolean;
}

export function ProtectedRoute({ children, requiredRole, redirectAdminsToAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Redirect to auth page if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect staff (non-subscribers) to admin dashboard if flag is set (e.g., on user dashboard)
  if (redirectAdminsToAdmin && user.role !== 'subscriber') {
    return <Navigate to="/admin" replace />;
  }

  // Check role if specified
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

