import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Success() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!sessionId) {
      setErrorKey("payment.noSessionId");
      setLoading(false);
      return;
    }

    const verifyPaymentAndRedirect = async () => {
      try {
        // Verify the session data from Stripe
        const sessionResponse = await fetch(`/api/session/${sessionId}`);
        if (!sessionResponse.ok) {
          throw new Error("payment.sessionFetchError");
        }
        const sessionData = await sessionResponse.json();
        
        console.log('🔵 [SUCCESS PAGE] Session data received:', {
          status: sessionData.status,
          subscriptionId: sessionData.subscriptionId,
          email: sessionData.email
        });

        // If payment is complete, redirect to onboarding
        if (sessionData.status === "complete") {
          // Try auto-login
          const autoLoginResponse = await fetch(`/api/auto-login/${sessionId}`, {
            method: 'POST',
            credentials: 'include'
          });

          // Redirect to onboarding with subscription ID if available
          const subscriptionParam = sessionData.subscriptionId 
            ? `?subscriptionId=${sessionData.subscriptionId}` 
            : '';
          
          console.log('🔵 [SUCCESS PAGE] Redirecting to onboarding:', {
            subscriptionId: sessionData.subscriptionId,
            url: `/onboarding${subscriptionParam}`
          });
          
          window.location.href = `/onboarding${subscriptionParam}`;
        } else {
          setErrorKey("payment.paymentNotCompleted");
          setLoading(false);
        }
      } catch (err) {
        // Only use the error message if it's a translation key (starts with "payment.")
        // Otherwise, use the generic error key to ensure proper localization
        const errorMessage = err instanceof Error ? err.message : "";
        const isTranslationKey = errorMessage.startsWith("payment.");
        setErrorKey(isTranslationKey ? errorMessage : "payment.errorOccurred");
        setLoading(false);
      }
    };

    verifyPaymentAndRedirect();
  }, [sessionId]);

  if (!sessionId) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (errorKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{t("payment.paymentError")}</h1>
          <p className="text-gray-600">{t(errorKey)}</p>
        </div>
      </div>
    );
  }

  return null;
}