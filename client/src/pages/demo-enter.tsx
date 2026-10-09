import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, Loader2 } from "lucide-react";
import { useAuth } from "@/components/ui/authContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function DemoEnter() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { setUser, setImpersonation } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [blockedBySession, setBlockedBySession] = useState(false);
  const [demoPath, setDemoPath] = useState(slug ? `/demo/${slug}` : "/demo");

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
          if (cancelled) return;
          if (data.code === "ACTIVE_SESSION_BLOCKS_DEMO") {
            setBlockedBySession(true);
            if (typeof data.demoPath === "string") setDemoPath(data.demoPath);
            setError(
              data.error ||
                t("demo.sessionBlocked") ||
                "You're already signed in. Open this link in a private window.",
            );
            return;
          }
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
  }, [slug, navigate, setUser, setImpersonation, t]);

  const absoluteUrl =
    typeof window !== "undefined" ? `${window.location.origin}${demoPath}` : demoPath;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast({
        title: t("demo.linkCopied") || "Link copied",
        description: t("demo.openInIncognito") || "Paste it into a private/incognito window.",
      });
    } catch {
      toast({
        title: t("demo.copyFailed") || "Could not copy",
        description: absoluteUrl,
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4 text-center max-w-lg mx-auto">
        <p className="text-destructive font-medium">{error}</p>
        {blockedBySession ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("demo.incognitoHint") ||
                "Browsers share one login cookie across tabs. Open a private/incognito window (Chrome: ⌘/Ctrl+Shift+N), paste the link there, and keep Admin in your normal window."}
            </p>
            <code className="text-xs bg-muted px-2 py-1.5 rounded break-all w-full">
              {absoluteUrl}
            </code>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button type="button" onClick={() => void copyLink()}>
                <Copy className="h-4 w-4 mr-2" />
                {t("demo.copyLink") || "Copy demo link"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin")}>
                {t("demo.backToAdmin") || "Back to admin"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("demo.unavailableHint") ||
              "This demo may be disabled. Please contact hayc for a walkthrough."}
          </p>
        )}
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
