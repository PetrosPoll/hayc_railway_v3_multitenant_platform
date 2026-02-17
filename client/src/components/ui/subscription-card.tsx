import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { subscriptionPlans, type StripePrice } from "@shared/schema";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionCardProps {
  plan: (typeof subscriptionPlans)[keyof typeof subscriptionPlans];
  onSubscribe: () => void;
  loading?: boolean;
  isCurrentPlan?: boolean;
  isYearly: boolean;
  dynamicPrices?: StripePrice[];
  pricesLoading?: boolean;
}

export function SubscriptionCard({
  plan,
  onSubscribe,
  loading,
  isCurrentPlan,
  isYearly,
  dynamicPrices,
  pricesLoading,
}: SubscriptionCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Helper function to translate features
  const translateFeature = (feature: string) => {
    const featureMap: { [key: string]: string } = {
      Maintenance: t("home.plans.features.maintenance"),
      Support: t("home.plans.features.support"),
      "Secure website": t("home.plans.features.secureWebsite"),
      "Changes 1 time per month": t("home.plans.features.changes1Month"),
      "Changes 2 time per month": t("home.plans.features.changes2Month"),
      "Changes unlimited per month": t("home.plans.features.changesUnlimited"),
      Hosting: t("home.plans.features.hosting"),
      "Domain name": t("home.plans.features.domainName"),
      Content: t("home.plans.features.content"),
      "1 professional Email": t("home.plans.features.email1"),
      "5 professional Email": t("home.plans.features.email5"),
      "Unlimited professional Email": t("home.plans.features.emailUnlimited"),
      "Everything that exists in Basic": t(
        "home.plans.features.everythingBasic",
      ),
      "Everything that exists in Professional": t(
        "home.plans.features.everythingProfessional",
      ),
      SEO: t("home.plans.features.seo"),
      "Advanced SEO": t("home.plans.features.advancedSeo"),
      "Connecting to third-party applications": t(
        "home.plans.features.thirdPartyApps",
      ),
      "Layout renewal every 24 months": t(
        "home.plans.features.layoutRenewal24",
      ),
      "Layout renewal every 12 months": t(
        "home.plans.features.layoutRenewal12",
      ),
      "Priority support": t("home.plans.features.prioritySupport"),
      "Custom integrations": t("home.plans.features.customIntegrations"),
      "3 pages": t("home.plans.features.3Pages"),
      "1 email (1GB)": t("home.plans.features.1Email1GB"),
      "1 change/month (10 days)": t("home.plans.features.1ChangeMonth10Days"),
      "Basic SEO": t("home.plans.features.basicSEO"),
      "Email support in Greek & English (72hr)": t("home.plans.features.emailSupportGreekEnglish72hr"),
      "10 pages": t("home.plans.features.10Pages"),
      "5 emails (1GB)": t("home.plans.features.5Emails1GB"),
      "2 changes/month (5 days)": t("home.plans.features.2ChangesMonth5Days"),
      "Analytics": t("home.plans.features.analytics"),
      "Advance SEO": t("home.plans.features.advanceSEO"),
      "Newsletter (3,000 emails/month)": t("home.plans.features.newsletter3000EmailsMonth"),
      "0% transactional fee on digital products / services selling": t("home.plans.features.zeroTransactionFee"),
      "Email support in Greek & English (48hr)": t("home.plans.features.emailSupportGreekEnglish48hr"),
      "Monthly strategy call": t("home.plans.features.monthlyStrategyCall"),
      "Phone Support": t("home.plans.features.phoneSupport"),
      "50 pages": t("home.plans.features.50Pages"),
      "20 emails (1GB)": t("home.plans.features.20Emails1GB"),
      "5 changes/month (48h)": t("home.plans.features.5ChangesMonth48h"),
      "Advanced Analytics": t("home.plans.features.advancedAnalytics"),
      "Newsletter (10,000 emails/month)": t("home.plans.features.newsletter10000EmailsMonth"),
      "All add-ons included for free": t("home.plans.features.allAddOnsIncluded"),
    };

    return featureMap[feature] || feature;
  };

  // Helper function to get the tooltip content for each feature
  const getTooltipContent = (feature: string) => {
    const featureTooltipMap: { [key: string]: string } = {
      // Basic Plan Features
      "3 pages": t("home.plans.tooltips.3Pages"),
      "1 email (1GB)": t("home.plans.tooltips.1Email1GB"),
      "1 change/month (10 days)": t("home.plans.tooltips.1ChangeMonth10Days"),
      "Basic SEO": t("home.plans.tooltips.basicSEO"),
      "Email support in Greek & English (72hr)": t("home.plans.tooltips.emailSupportGreekEnglish72hr"),
      
      // Essential Plan Features
      "10 pages": t("home.plans.tooltips.10Pages"),
      "5 emails (1GB)": t("home.plans.tooltips.5Emails1GB"),
      "2 changes/month (5 days)": t("home.plans.tooltips.2ChangesMonth5Days"),
      "Analytics": t("home.plans.tooltips.analytics"),
      "Advance SEO": t("home.plans.tooltips.advanceSEO"),
      "Newsletter (3,000 emails/month)": t("home.plans.tooltips.newsletter3000EmailsMonth"),
      "0% transactional fee on digital products / services selling": t("home.plans.tooltips.zeroTransactionFee"),
      "Email support in Greek & English (48hr)": t("home.plans.tooltips.emailSupportGreekEnglish48hr"),
      
      // Pro Plan Features
      "Monthly strategy call": t("home.plans.tooltips.monthlyStrategyCall"),
      "Phone Support": t("home.plans.tooltips.phoneSupport"),
      "50 pages": t("home.plans.tooltips.50Pages"),
      "20 emails (1GB)": t("home.plans.tooltips.20Emails1GB"),
      "5 changes/month (48h)": t("home.plans.tooltips.5ChangesMonth48h"),
      "Advanced Analytics": t("home.plans.tooltips.advancedAnalytics"),
      "Advanced SEO": t("home.plans.tooltips.advancedSEO"),
      "Newsletter (10,000 emails/month)": t("home.plans.tooltips.newsletter10000EmailsMonth"),
      "All add-ons included for free": t("home.plans.tooltips.allAddOnsIncluded"),
    };
    
    return featureTooltipMap[feature] || t("home.plans.tooltips.default");
  };

  // Calculate the price based on billing period
  // Get dynamic prices from Stripe or fall back to hardcoded values
  const monthlyPriceData = dynamicPrices?.find(
    (p) => p.tier === plan.id && p.billingPeriod === "monthly"
  );
  const yearlyPriceData = dynamicPrices?.find(
    (p) => p.tier === plan.id && p.billingPeriod === "yearly"
  );
  
  const monthlyPrice = monthlyPriceData?.unitAmount ?? plan.price;
  const yearlyPrice = yearlyPriceData?.unitAmount ?? plan.yearlyPrice;
  const yearlyPricePerMonth = yearlyPrice / 12;
  
  // For yearly plans, show monthly equivalent; for monthly plans, show monthly price
  const displayPrice = isYearly ? yearlyPricePerMonth : monthlyPrice;
  
  // Always show "/month" for both monthly and yearly plans
  const billingPeriod = t("home.plans.period.month");

  return (
    <TooltipProvider>
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-[#182B53]">
            {plan.name}
            {isCurrentPlan && (
              <span className="ml-2 text-sm text-green-500">(Current Plan)</span>
            )}
          </CardTitle>
          <div className="mt-2 space-y-2">
            {pricesLoading ? (
              <>
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-24" />
              </>
            ) : (
              <>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-[#182B53]">{displayPrice.toFixed(0)}€</span>
                  <span className="ml-1 text-gray-500">{billingPeriod}</span>
                </div>
                {isYearly && (
                  <div className="text-sm text-muted-foreground">
                    {t("home.plans.period.billedYearly")}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  + {plan.setupFee}€ {t("home.plans.setupFee")}
                </div>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          <ul className="space-y-3">
            {plan.features.map((feature) => {
              const translatedFeature = translateFeature(feature);
              return (
                <li key={feature} className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-[#2777E9]" />
                  <span className="text-[#182B53]">
                    {translatedFeature}
                  </span>
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <button className="ml-2 p-1 h-4 w-4 bg-[#182B53] text-white rounded-full hover:bg-[#2777E9] flex items-center justify-center text-[10px] font-bold">
                        ?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      align="center"
                      className="max-w-[280px] bg-gray-900 text-white border-gray-700"
                      sideOffset={8}
                      collisionPadding={10}
                    >
                      <p className="text-xs leading-relaxed">{getTooltipContent(feature)}</p>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
          <Button
            className="mt-6 w-full"
            onClick={() =>
              navigate(`/pre-checkout/${plan.id}?isYearly=${isYearly}`)
            }
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : isCurrentPlan
                ? t("home.plans.subscribe.again")
                : t("home.plans.subscribe.now")}
          </Button>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
