import { Eye, Loader2, X } from "lucide-react";
import { Button } from "./button";
import { useAuth } from "./authContext";
import { useImpersonation } from "@/hooks/use-impersonation";

export function ImpersonationBanner() {
  const { user, impersonation } = useAuth();
  const { stopImpersonation, isStopping } = useImpersonation();

  if (!impersonation?.active || !user) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          Viewing as <strong>{user.username}</strong> ({user.email})
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => stopImpersonation()}
        disabled={isStopping}
        className="shrink-0 border-amber-400 bg-white hover:bg-amber-100"
      >
        {isStopping ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <X className="mr-1 h-4 w-4" />
            Exit customer view
          </>
        )}
      </Button>
    </div>
  );
}
