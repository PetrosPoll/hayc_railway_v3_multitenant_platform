import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { subscriptionPlans } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, CreditCard, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  vatNumber: z.string().optional(),
  invoiceType: z.enum(["invoice", "receipt"]).default("invoice"),
});

type FormData = z.infer<typeof schema>;

export default function UpgradeConfirmation() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscriptionId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const currentTier = searchParams.get("tier") as keyof typeof subscriptionPlans;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vatNumber: "",
      invoiceType: "invoice",
    },
  });

  // Get current subscription details
  const { data: userResponse } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const response = await fetch("/api/user");
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
  });

  const currentSubscription = userResponse?.subscriptions?.find(
    (sub: any) => sub.id === parseInt(subscriptionId || "0")
  );

  const plan = currentTier ? subscriptionPlans[currentTier] : null;

  const upgradeMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetBillingPeriod: "yearly",
          vatNumber: formData.invoiceType === "invoice" ? formData.vatNumber : "",
          invoiceType: formData.invoiceType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upgrade subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upgrade Successful!",
        description: "Your subscription has been upgraded to yearly billing. The value of any unused days from your previous monthly plan has been deducted from the total amount.",
      });
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      await upgradeMutation.mutateAsync(formData);
    } finally {
      setLoading(false);
    }
  };

  // Early return after all hooks are called
  if (!plan || !currentSubscription) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Invalid Upgrade Request</h1>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  // Calculate savings and dates
  const monthlyPrice = plan.price;
  const yearlyPrice = plan.yearlyPrice;
  const monthlySavings = (monthlyPrice * 12 - yearlyPrice).toFixed(2);

  // Use the actual current period end from subscription data
  const currentPeriodEnd = currentSubscription?.currentPeriodEnd 
    ? new Date(currentSubscription.currentPeriodEnd) 
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback to 30 days from now

  const yearlyPeriodStart = new Date(currentPeriodEnd); // Start exactly when current period ends

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("el", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-background pt-16 pb-24">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("upgradeConfirmation.backToDashboard")}
        </Button>

        <h1 className="text-3xl font-bold mb-8">
          {t("upgradeConfirmation.title")}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left column - Upgrade details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="mr-2 h-5 w-5" />
                  {t("upgradeConfirmation.whatHappening")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>
                    {t("upgradeConfirmation.upgradeDescription1")} {plan.name} {t("upgradeConfirmation.upgradeDescription2")}
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("upgradeConfirmation.currentPlan")}</span>
                    <span className="font-medium">{plan.name} {t("upgradeConfirmation.monthly")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("upgradeConfirmation.upgradingTo")}</span>
                    <span className="font-medium text-green-600">{plan.name} {t("upgradeConfirmation.yearly")}</span>
                  </div>
                  {/* <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Period Was Set To End:</span>
                    <span className="font-medium">
                      {formatDate(currentPeriodEnd)}
                    </span>
                  </div> */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("upgradeConfirmation.deductedAmount")}</span>
                    <span className="font-medium text-green-600 text-end">{t("upgradeConfirmation.creditedToward")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("upgradeConfirmation.yearlyBillingStarts")}</span>
                    <span className="font-medium text-blue-600 text-end">{t("upgradeConfirmation.immediatelyAfterUpgrade")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("upgradeConfirmation.nextBillingDate")}</span>
                    <span className="font-medium">
                      {formatDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>💰 {t("upgradeConfirmation.yourSavings")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>{t("upgradeConfirmation.monthlyPlan12Months")}</span>
                    <span>€{(monthlyPrice * 12).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("upgradeConfirmation.yearlyPlan")}</span>
                    <span>€{yearlyPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-green-600 pt-2 border-t">
                    <span>{t("upgradeConfirmation.totalSavings")}</span>
                    <span>€{monthlySavings}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("upgradeConfirmation.save")} €{(parseFloat(monthlySavings) / 12).toFixed(2)} {t("upgradeConfirmation.savePerMonth")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Billing information */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5" />
                  {t("upgradeConfirmation.billingInformation")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">{t("upgradeConfirmation.accountEmail")}</div>
                      <div className="font-medium">{user?.email}</div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">{t("upgradeConfirmation.username")}</div>
                      <div className="font-medium">{user?.username}</div>
                    </div>

                    <FormField
                      control={form.control}
                      name="invoiceType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>{t("upgradeConfirmation.documentType")}</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="invoice" id="invoice" />
                                <FormLabel
                                  htmlFor="invoice"
                                  className="font-normal cursor-pointer"
                                >
                                  {t("upgradeConfirmation.invoiceVatNeeded")}
                                </FormLabel>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="receipt" id="receipt" />
                                <FormLabel
                                  htmlFor="receipt"
                                  className="font-normal cursor-pointer"
                                >
                                  {t("upgradeConfirmation.receiptNoVatNeeded")}
                                </FormLabel>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("invoiceType") === "invoice" && (
                      <FormField
                        control={form.control}
                        name="vatNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("upgradeConfirmation.vatNumber")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("upgradeConfirmation.enterVatNumber")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="pt-4 border-t">
                      <h3 className="font-medium mb-2">{t("upgradeConfirmation.yearlySubscriptionSummary")}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>{plan.name} ({t("upgradeConfirmation.yearly")})</span>
                          <span>${yearlyPrice.toFixed(2)}{t("home.plans.period.year")}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{t("upgradeConfirmation.equivalentTo")}</span>
                          <span>${(yearlyPrice / 12).toFixed(2)}{t("home.plans.period.month")}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>{t("upgradeConfirmation.annualTotal")}</span>
                          <span>${yearlyPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-[#2777E9] hover:bg-[#1e5dc4]"
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      {t("upgradeConfirmation.upgradeToYearlyNow")}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      {t("upgradeConfirmation.upgradeAgreement")}
                    </p>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}