import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingLogoSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paymentIntent = searchParams.get("payment_intent");
    
    // Must have either session_id (from Checkout) or payment_intent (from saved card)
    if (!sessionId && !paymentIntent) {
      setError("Invalid payment session");
      setProcessing(false);
      return;
    }

    // Retrieve onboarding data from sessionStorage
    const onboardingDataStr = sessionStorage.getItem("onboardingData");
    
    if (!onboardingDataStr) {
      setError("Onboarding data not found");
      setProcessing(false);
      return;
    }

    // Submit the onboarding form now that payment is complete
    const submitOnboarding = async () => {
      try {
        const data = JSON.parse(onboardingDataStr);
        
        // Convert to FormData (matching the onboarding form's format)
        const formData = new FormData();
        
        // Helper function to convert values to strings for FormData
        const toString = (value: any): string => {
          if (value === null || value === undefined) return "";
          if (Array.isArray(value)) return value.join(", ");
          if (typeof value === "boolean") return value ? "true" : "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        };
        
        // Add all fields from the data object
        Object.keys(data).forEach(key => {
          formData.append(key, toString(data[key]));
        });
        
        const response = await fetch("/api/onboarding-form", {
          method: "POST",
          body: formData, // Send as FormData, not JSON
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Onboarding submission error:", errorData);
          throw new Error("Failed to submit onboarding form");
        }

        const result = await response.json();
        
        // Clear session storage
        sessionStorage.removeItem("onboardingData");
        sessionStorage.removeItem("logoType");
        sessionStorage.removeItem("paymentIntentId");
        
        // Redirect to dashboard after brief delay
        setTimeout(() => {
          navigate(`/dashboard?new=true`);
        }, 2000);
        
      } catch (err) {
        console.error("Onboarding submission error:", err);
        setError("Failed to complete onboarding. Please contact support.");
        setProcessing(false);
      }
    };

    submitOnboarding();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {processing && "Processing Payment..."}
            {error && "Payment Error"}
            {!processing && !error && "Payment Successful!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {processing && (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
              <p className="text-gray-600">
                Please wait while we complete your onboarding...
              </p>
            </div>
          )}
          {error && (
            <div className="space-y-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}
          {!processing && !error && (
            <div className="space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
              <p className="text-gray-600">
                Redirecting to your dashboard...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
