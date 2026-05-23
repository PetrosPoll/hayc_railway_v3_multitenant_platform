import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
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
        <svg
          width="52"
          height="52"
          viewBox="0 0 24.24 23.468"
          fill="none"
          style={{ animation: "pulse 1.5s ease-in-out infinite" }}
        >
          <path
            d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
            fill="#ED4C14"
          />
        </svg>
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
