import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null; // still loading

  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
