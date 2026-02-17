import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subscriptionPlans, availableAddOns } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Calendar, DollarSign, Tag, Check, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { usePricing, getPrice, calculateYearlySavings } from "@/hooks/use-pricing";
import { Skeleton } from "@/components/ui/skeleton";

interface UpgradePreview {
  prorationCredit: number;
  yearlyCharge: number;
  amountDue: number;
  daysRemaining: number;
  currency: string;
}

interface CouponValidation {
  valid: boolean;
  couponId: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  discountAmount: number;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  durationInMonths: number | null;
}

interface UpgradeToYearlyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: number;
  tier: string;
  currentPeriodEnd?: Date;
  vatNumber?: string;
  invoiceType?: "invoice" | "receipt";
}

export function UpgradeToYearlyDialog({
  open,
  onOpenChange,
  subscriptionId,
  tier,
  currentPeriodEnd,
  vatNumber,
  invoiceType,
}: UpgradeToYearlyDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const plan = subscriptionPlans[tier as keyof typeof subscriptionPlans];

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCouponCode("");
      setAppliedCoupon(null);
      setCouponError(null);
    }
  }, [open]);

  const { data: prices, isLoading: pricesLoading } = usePricing();

  const { data: subscriptionData } = useQuery({
    queryKey: [`/api/subscriptions`],
    enabled: open && !plan,
    select: (data: any) => {
      if (Array.isArray(data)) {
        const sub = data.find((sub: any) => sub.id === subscriptionId);
        return sub;
      }
      return null;
    },
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<{ success: boolean; preview: UpgradePreview }>({
    queryKey: [`/api/subscriptions/${subscriptionId}/upgrade-preview`],
    enabled: open,
    staleTime: 60000,
  });

  const validateCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const yearlyAmount = previewData?.preview?.yearlyCharge || yearlyPrice;
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ couponCode: code, yearlyAmount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Invalid coupon code");
      }

      return response.json() as Promise<CouponValidation>;
    },
    onSuccess: (data) => {
      setAppliedCoupon(data);
      setCouponError(null);
      toast({
        title: t("actions.upgradeConfirmation.couponApplied") || "Coupon Applied!",
        description: data.discountType === "percent" 
          ? `${data.discountValue}% discount applied`
          : `€${data.discountValue} discount applied`,
      });
    },
    onError: (error: Error) => {
      setAppliedCoupon(null);
      setCouponError(error.message);
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetBillingPeriod: "yearly",
          vatNumber: invoiceType === "invoice" ? vatNumber : "",
          invoiceType: invoiceType || "invoice",
          couponCode: appliedCoupon?.couponId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upgrade subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Upgrade Successful!",
        description: "Your subscription has been upgraded to yearly billing. Any unused days from your monthly plan have been credited toward the upgrade.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApplyCoupon = () => {
    if (couponCode.trim()) {
      validateCouponMutation.mutate(couponCode.trim());
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  const monthlyPriceData = plan ? getPrice(prices, tier as "basic" | "essential" | "pro", "monthly") : undefined;
  const yearlyPriceData = plan ? getPrice(prices, tier as "basic" | "essential" | "pro", "yearly") : undefined;

  // Get add-on info from schema when tier is an add-on
  const addonConfig = !plan ? availableAddOns.find(a => a.id === tier) : undefined;
  const addonHasYearlyPrice = addonConfig && 'yearlyPrice' in addonConfig;
  
  let addonMonthlyPrice: number | undefined = undefined;
  let addonYearlyPrice: number | undefined = undefined;

  if (!plan && addonConfig) {
    // Always use schema monthly price for add-ons
    addonMonthlyPrice = addonConfig.price;
    // Use schema yearly price if defined, otherwise default to monthly * 12 (no discount)
    addonYearlyPrice = addonHasYearlyPrice 
      ? (addonConfig as any).yearlyPrice 
      : addonConfig.price * 12;
  } else if (!plan && subscriptionData?.price) {
    // Fallback to subscription data if no schema config
    addonMonthlyPrice = subscriptionData.billingPeriod === "yearly"
      ? (subscriptionData.price / 100) / 12
      : subscriptionData.price / 100;
    addonYearlyPrice = addonMonthlyPrice * 12;
  }

  const monthlyPrice = monthlyPriceData?.unitAmount ?? plan?.price ?? addonMonthlyPrice ?? 0;
  const yearlyPrice = yearlyPriceData?.unitAmount ?? plan?.yearlyPrice ?? addonYearlyPrice ?? 0;

  const calculateCouponDiscount = (amount: number): number => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === "percent") {
      return (amount * appliedCoupon.discountValue) / 100;
    }
    return appliedCoupon.discountValue;
  };

  const couponDiscount = calculateCouponDiscount(previewData?.preview?.yearlyCharge || yearlyPrice);
  const finalYearlyPrice = (previewData?.preview?.yearlyCharge || yearlyPrice) - couponDiscount;
  const finalAmountDue = (previewData?.preview?.amountDue || 0) - couponDiscount;

  const { savings, percentage } = calculateYearlySavings(monthlyPrice, yearlyPrice);
  const totalSavingsWithCoupon = savings + couponDiscount;
  const monthlySavings = totalSavingsWithCoupon.toFixed(2);
  const savingsPercentage = percentage.toFixed(0);

  const daysRemaining = currentPeriodEnd
    ? Math.max(0, Math.ceil((currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-600" />
            {t("actions.upgradeToYearlyDialog.title")} {pricesLoading ? "..." : (savings > 0 || appliedCoupon ? `${savingsPercentage}%` : "")}
          </DialogTitle>
          <DialogDescription>
            {t("actions.upgradeToYearlyDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Coupon Code Input - Compact */}
          <div className="space-y-2">
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-sm bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-green-700 dark:text-green-300">{t("actions.upgradeConfirmation.coupon")}:</span>
                  <span className="font-medium text-green-800 dark:text-green-200">{appliedCoupon.name}</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    ({appliedCoupon.discountType === "percent" 
                      ? `-${appliedCoupon.discountValue}%` 
                      : `-€${appliedCoupon.discountValue}`})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCoupon}
                  className="h-6 px-2 text-green-600 hover:text-destructive hover:bg-transparent"
                  data-testid="button-remove-coupon"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder={t("actions.upgradeConfirmation.enterCouponCode")}
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setCouponError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                  className="h-8 text-sm flex-1"
                  data-testid="input-coupon-code"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim() || validateCouponMutation.isPending}
                  className="h-8"
                  data-testid="button-apply-coupon"
                >
                  {validateCouponMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    t("actions.upgradeConfirmation.apply")
                  )}
                </Button>
              </div>
            )}
            {couponError && (
              <p className="text-xs text-destructive pl-6" data-testid="text-coupon-error">
                {couponError}
              </p>
            )}
          </div>

          {/* Savings Breakdown - only show if there are actual savings or a coupon is applied */}
          {(savings > 0 || appliedCoupon) && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t("actions.upgradeConfirmation.yourAnnualSavings")}
              </h3>
              {pricesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-800 dark:text-green-200">{t("upgradeConfirmation.monthlyPlan12Months")}</span>
                    <span className="font-medium">€{(monthlyPrice * 12).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-800 dark:text-green-200">{t("upgradeConfirmation.yearlyPlan")}</span>
                    <span className={`font-medium ${appliedCoupon ? "line-through text-gray-400" : ""}`}>
                      €{yearlyPrice.toFixed(2)}
                    </span>
                  </div>
                  {appliedCoupon && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-800 dark:text-green-200">
                          {t("actions.upgradeConfirmation.couponDiscount") || "Coupon discount"}
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          -€{couponDiscount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-800 dark:text-green-200">
                          {t("actions.upgradeConfirmation.yearlyPlanWithCoupon") || "Yearly plan (with coupon)"}
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          €{finalYearlyPrice.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-green-600 dark:text-green-400 pt-2 border-t border-green-200 dark:border-green-700">
                    <span>{t("upgradeConfirmation.totalSavings")}</span>
                    <span className="text-lg">€{monthlySavings}</span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                    {t("actions.upgradeConfirmation.savePerMonth")} €{(parseFloat(monthlySavings) / 12).toFixed(2)} {t("actions.upgradeConfirmation.perMonth")}!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Proration Credit Breakdown */}
          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t("actions.upgradeConfirmation.creditFromCurrentPlan")}
            </h3>
            {previewLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            ) : previewData?.preview ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-purple-800 dark:text-purple-200">
                    {t("actions.upgradeConfirmation.daysRemainingOnMonthlyPlan")}
                  </span>
                  <span className="font-medium">{previewData.preview.daysRemaining} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-purple-800 dark:text-purple-200">{t("actions.upgradeConfirmation.creditFromUnusedDays")}</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    -€{previewData.preview.prorationCredit.toFixed(2)}
                  </span>
                </div>
                <div className="h-px bg-purple-200 dark:bg-purple-700 my-2"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-purple-800 dark:text-purple-200">{t("actions.upgradeConfirmation.yearlyPlan")}</span>
                  <span className={`font-medium ${appliedCoupon ? "line-through text-gray-400" : ""}`}>
                    €{previewData.preview.yearlyCharge.toFixed(2)}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-800 dark:text-purple-200">
                      {t("actions.upgradeConfirmation.couponDiscount") || "Coupon discount"}
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -€{couponDiscount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-purple-800 dark:text-purple-200">{t("actions.upgradeConfirmation.creditApplied")}</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    -€{previewData.preview.prorationCredit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-purple-900 dark:text-purple-100 pt-2 border-t border-purple-200 dark:border-purple-700">
                  <span>{t("actions.upgradeConfirmation.amountToPayToday")}</span>
                  <span className="text-lg">€{Math.max(0, finalAmountDue).toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-purple-700 dark:text-purple-300">
                {t("actions.upgradeConfirmation.loadingProrationDetails")}
              </p>
            )}
          </div>

          {/* What Happens with Remaining Days */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("actions.upgradeConfirmation.whatHappensNext")}
            </h3>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <p>✓ {t("actions.upgradeConfirmation.yourYearlyBillingStarts")} <strong>{t("actions.upgradeConfirmation.immediately")}</strong></p>
              <p>✓ {t("actions.upgradeConfirmation.theCreditFromYourUnusedDaysIsAutomaticallyApplied")}</p>
              <p>✓ {t("actions.upgradeConfirmation.nextBillingDate")}: <strong>{new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}</strong></p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={upgradeMutation.isPending}
              data-testid="button-cancel-upgrade"
            >
              {t("actions.upgradeConfirmation.cancel")}
            </Button>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              disabled={upgradeMutation.isPending}
              onClick={() => upgradeMutation.mutate()}
              data-testid="button-confirm-upgrade"
            >
              {upgradeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("actions.upgradeConfirmation.upgrading")}
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {savings > 0 || appliedCoupon 
                    ? `${t("actions.upgradeConfirmation.upgradeAndSave")} €${monthlySavings}`
                    : t("actions.upgradeToYearlyDialog.upgradeToYearly") || "Upgrade to Yearly"}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
