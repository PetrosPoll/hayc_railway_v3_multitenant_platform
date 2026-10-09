import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";

export function useImpersonation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setUser, setImpersonation, impersonation } = useAuth();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const startImpersonation = async (
    userId: number,
    options?: { redirectTo?: string },
  ) => {
    setIsStarting(true);
    try {
      const response = await fetch(`/api/admin/impersonate/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start impersonation");
      }
      const data = await response.json();
      // Keep full user (incl. isDemo); UI unlocks via impersonation.active in useDemoMode.
      setUser(data.user);
      if (!data.impersonation?.active) {
        throw new Error("Impersonation session was not established");
      }
      setImpersonation(data.impersonation);
      queryClient.clear();
      navigate(options?.redirectTo || "/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to view as customer",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const stopImpersonation = async () => {
    setIsStopping(true);
    try {
      const response = await fetch("/api/admin/stop-impersonation", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stopToken: impersonation?.stopToken,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to stop impersonation");
      }
      const data = await response.json();
      setUser(data.user);
      setImpersonation(null);
      queryClient.clear();
      navigate("/admin");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to exit customer view",
        variant: "destructive",
      });
    } finally {
      setIsStopping(false);
    }
  };

  return {
    startImpersonation,
    stopImpersonation,
    isStarting,
    isStopping,
  };
}
