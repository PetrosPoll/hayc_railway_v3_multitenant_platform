
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, CheckCircle, Gift, Star } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function ReviewsProgram() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [hasSubmittedReviews, setHasSubmittedReviews] = useState(false);

  // Check user's coupon status
  const { data: couponStatus, isLoading: isLoadingCouponStatus } = useQuery({
    queryKey: ["user-coupon-status", "H0KCP9s8"],
    queryFn: async () => {
      const response = await fetch("/api/user/coupon-status/H0KCP9s8", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch coupon status");
      }
      return response.json();
    },
  });

  const checkReviewsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/check-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit review check request");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("reviewsProgram.notifications.success"),
        description: t("reviewsProgram.notifications.successDescription"),
      });
      setHasSubmittedReviews(true);
    },
    onError: (error: Error) => {
      toast({
        title: t("reviewsProgram.notifications.error"),
        description: error.message || t("reviewsProgram.notifications.errorDescription"),
        variant: "destructive",
      });
    },
  });

  // If user already has the coupon or no active subscription, redirect to dashboard
  // if (!isLoadingCouponStatus && couponStatus && (couponStatus.hasCoupon || !couponStatus.hasActiveSubscription)) {
  //   return <Navigate to="/dashboard" replace />;
  // }

  // Show loading while checking coupon status
  if (isLoadingCouponStatus) {
    return (
      <div className="min-h-[calc(100vh-4rem)] pt-16 bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t("reviewsProgram.loading")}</p>
        </div>
      </div>
    );
  }

  const handleCheckReviews = () => {
    checkReviewsMutation.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pt-16 bg-white from-blue-50 to-green-50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🎁 {t("reviewsProgram.title")}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t("reviewsProgram.subtitle")}
            </p>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Step 1 - Facebook Review */}
            <Card className="border-2 border-blue-200 hover:border-blue-300 transition-colors flex flex-col justify-between">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-blue-700">
                  <div className="bg-blue-100 rounded-full p-2 mr-3">
                    <Star className="h-6 w-6 text-blue-600" />
                  </div>
                  {t("reviewsProgram.step1.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  {t("reviewsProgram.step1.description")}
                </p>
                <Button
                  asChild
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <a
                    href="https://www.facebook.com/haycWebsites/reviews"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("reviewsProgram.step1.button")}
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Step 2 - Trustpilot Review */}
            <Card className="border-2 border-green-200 hover:border-green-300 transition-colors flex flex-col justify-between">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-green-700">
                  <div className="bg-green-100 rounded-full p-2 mr-3">
                    <Star className="h-6 w-6 text-green-600" />
                  </div>
                  {t("reviewsProgram.step2.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  {t("reviewsProgram.step2.description")}
                </p>
                <Button
                  asChild
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <a
                    href="https://www.trustpilot.com/review/hayc.gr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("reviewsProgram.step2.button")}
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Step 3 - G2 Review */}
            <Card className="border-2 border-orange-200 hover:border-orange-300 transition-colors flex flex-col justify-between">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-orange-700">
                  <div className="bg-orange-100 rounded-full p-2 mr-3">
                    <Star className="h-6 w-6 text-orange-600" />
                  </div>
                  {t("reviewsProgram.step3.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  {t("reviewsProgram.step3.description")}
                </p>
                <Button
                  asChild
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  <a
                    href="https://www.g2.com/products/hayc/take_survey?"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("reviewsProgram.step3.button")}
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Verification Section */}
          <Card className="border-2 bg-transparent" style={{ borderColor: 'rgb(24, 43, 83)' }}>
            <CardHeader>
              <CardTitle className="flex items-center" style={{ color: '#182B53' }}>
                <CheckCircle className="mr-3 h-6 w-6" />
                {t("reviewsProgram.step4.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6" style={{ color: '#182B53' }}>
                {t("reviewsProgram.step4.description")}
              </p>

              {hasSubmittedReviews ? (
                <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">
                    {t("reviewsProgram.success.title")}
                  </p>
                  <p className="text-green-700 text-sm mt-1">
                    {t("reviewsProgram.success.description")}
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleCheckReviews}
                  disabled={checkReviewsMutation.isPending}
                  className={`w-full text-white font-medium py-3 text-lg transition-colors ${
                    checkReviewsMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
                  }`}
                  style={{ 
                    backgroundColor: '#182B53'
                  }}
                  onMouseEnter={(e) => {
                    if (!checkReviewsMutation.isPending) {
                      e.currentTarget.style.backgroundColor = 'rgb(24, 43, 83)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!checkReviewsMutation.isPending) {
                      e.currentTarget.style.backgroundColor = '#182B53';
                    }
                  }}
                >
                  {checkReviewsMutation.isPending ? (
                    t("reviewsProgram.step4.submitting")
                  ) : (
                    t("reviewsProgram.step4.button")
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Terms */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
            <h3 className="font-semibold text-gray-900 mb-3">{t("reviewsProgram.terms.title")}</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• {t("reviewsProgram.terms.item1")}</li>
              <li>• {t("reviewsProgram.terms.item2")}</li>
              <li>• {t("reviewsProgram.terms.item3")}</li>
              <li>• {t("reviewsProgram.terms.item4")}</li>
              <li>• {t("reviewsProgram.terms.item5")}</li>
              <li>• {t("reviewsProgram.terms.item6")}</li>
              <li>• {t("reviewsProgram.terms.item7")}</li>
              <li>• {t("reviewsProgram.terms.item8")}</li>
              <li>• {t("reviewsProgram.terms.item9")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
