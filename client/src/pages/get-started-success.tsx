import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function GetStartedSuccess() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const stripeSessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!stripeSessionId) {
      setErrorKey("payment.noSessionId");
      setLoading(false);
      return;
    }

    const verifyAndRedirect = async () => {
      try {
        const sessionResponse = await fetch(`/api/session/${stripeSessionId}`);
        if (!sessionResponse.ok) {
          throw new Error("payment.sessionFetchError");
        }
        const sessionData = await sessionResponse.json();

        if (sessionData.status !== "complete") {
          setErrorKey("payment.paymentNotCompleted");
          setLoading(false);
          return;
        }

        // Auto-login
        await fetch(`/api/auto-login/${stripeSessionId}`, {
          method: "POST",
          credentials: "include",
        });

        const gsSessionId = sessionData?.metadata?.getStartedSessionId;

        if (!gsSessionId) {
          setErrorKey("payment.errorOccurred");
          setLoading(false);
          return;
        }

        const destination = `/get-started/onboarding?s=${gsSessionId}`;

        // Hard redirect — forces full page reload so useAuth reads fresh session
        window.location.href = destination;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "";
        const isTranslationKey = errorMessage.startsWith("payment.");
        setErrorKey(isTranslationKey ? errorMessage : "payment.errorOccurred");
        setLoading(false);
      }
    };

    verifyAndRedirect();
  }, [stripeSessionId]);

  if (!stripeSessionId) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (errorKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            {t("payment.paymentError")}
          </h1>
          <p className="text-white/60">{t(errorKey)}</p>
        </div>
      </div>
    );
  }

  return null;
}
