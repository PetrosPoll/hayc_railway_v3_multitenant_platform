import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/ui/authContext";
import { useTranslation } from "react-i18next";

export default function DemoEnter() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { setUser, setImpersonation } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const enter = async () => {
      try {
        const res = await fetch("/api/demo/enter", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slug || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to open demo");
        }
        if (cancelled) return;
        setImpersonation(null);
        setUser(data.user ?? null);
        navigate(data.redirectTo || `/dashboard/website/${data.websiteId}`, {
          replace: true,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to open demo");
        }
      }
    };

    void enter();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate, setUser, setImpersonation]);

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-destructive font-medium">{error}</p>
        <p className="text-sm text-muted-foreground">
          {t("demo.unavailableHint") ||
            "This demo may be disabled. Please contact hayc for a walkthrough."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {t("demo.loading") || "Opening demo dashboard…"}
      </p>
    </div>
  );
}
