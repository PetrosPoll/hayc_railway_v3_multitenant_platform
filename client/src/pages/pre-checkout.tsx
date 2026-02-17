import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { subscriptionPlans, availableAddOns } from "@shared/schema";
import { createCheckoutSession, checkEmailExists } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check } from "lucide-react";

// Use centralized add-ons configuration
const AVAILABLE_ADDONS = availableAddOns;

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 characters")
    .optional()
    .or(z.literal("")),
  vatNumber: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  postalCode: z.string().optional(),
  billingPeriod: z.enum(["monthly", "yearly"]),
  invoiceType: z.enum(["invoice", "receipt"]).default("invoice"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
}).refine(
  (data) => {
    if (data.invoiceType === "invoice") {
      return data.vatNumber && data.vatNumber.trim().length > 0;
    }
    return true;
  },
  {
    message: "VAT Number is required for invoices",
    path: ["vatNumber"],
  }
).refine(
  (data) => {
    if (data.invoiceType === "invoice") {
      return data.city && data.city.trim().length > 0;
    }
    return true;
  },
  {
    message: "City is required for invoices",
    path: ["city"],
  }
).refine(
  (data) => {
    if (data.invoiceType === "invoice") {
      return data.street && data.street.trim().length > 0;
    }
    return true;
  },
  {
    message: "Street is required for invoices",
    path: ["street"],
  }
).refine(
  (data) => {
    if (data.invoiceType === "invoice") {
      return data.number && data.number.trim().length > 0;
    }
    return true;
  },
  {
    message: "Street number is required for invoices",
    path: ["number"],
  }
).refine(
  (data) => {
    if (data.invoiceType === "invoice") {
      return data.postalCode && data.postalCode.trim().length > 0;
    }
    return true;
  },
  {
    message: "Postal code is required for invoices",
    path: ["postalCode"],
  }
);

type FormData = z.infer<typeof schema>;

interface PreCheckoutPageProps {
  planId: string;
  isYearly: boolean;
  isResume?: boolean;
}

function PreCheckoutPage({
  planId,
  isYearly,
  isResume = false,
}: PreCheckoutPageProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  //const queryClient = useQueryClient(); //Removed as it's unused and causing error

  // Get planId and isYearly from URL parameters
  const isResumeFlow = location.search.includes("isResume=true");

  // Reset form when auth state changes
  useEffect(() => {
    console.log("========");
    console.log(user);
    //Removed queryClient subscription as it's causing errors and not necessary for logging.
  }, [user]);

  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Setup form with react-hook-form and zod validation
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: user?.email || "",
      username: user?.username || "",
      phone: "",
      vatNumber: "",
      city: "",
      street: "",
      number: "",
      postalCode: "",
      billingPeriod: isYearly ? "yearly" : "monthly",
      invoiceType: "invoice",
      password: "", // Add empty default for password
    },
  });

  // Get plan details
  const plan =
    subscriptionPlans[planId as keyof typeof subscriptionPlans] || null;

  if (!plan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">
          {t("preCheckout.invalidPlanSelected")}
        </h1>
        <Button onClick={() => navigate("/")} className="mt-4">
          {t("preCheckout.returnToPlans")}
        </Button>
      </div>
    );
  }

  // Reset form with user data when it becomes available
  useEffect(() => {
    console.log("User data changed:", user);
    console.log("Current form values:", form.getValues());

    if (user) {
      console.log("Resetting form with user data");
      form.reset(
        {
          email: user?.email,
          username: user?.username,
          phone: "",
          vatNumber: "",
          billingPeriod: isYearly ? "yearly" : "monthly",
        },
        {
          keepDefaultValues: false,
        },
      );
      console.log("Form values after reset:", form.getValues());
    } else {
      console.log("No user data, clearing form");
      form.reset({
        email: "",
        username: "",
        phone: "",
        vatNumber: "",
        billingPeriod: isYearly ? "yearly" : "monthly",
      });
    }
  }, [user, isYearly]);

  // Monitor form changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      console.log("Form values changed:", value);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Toggle add-on selection
  const toggleAddon = (addonId: string) => {
    setSelectedAddons((current) =>
      current.includes(addonId)
        ? current.filter((id) => id !== addonId)
        : [...current, addonId],
    );
  };

  // Calculate totals separately
  const calculateTotals = () => {
    const planPrice = isYearly ? plan.yearlyPrice : plan.price;
    const addonTotal = selectedAddons.reduce((total, addonId) => {
      const addon = AVAILABLE_ADDONS.find((a) => a.id === addonId);
      // Addons are monthly - if plan is yearly, show yearly equivalent
      const addonPrice = addon ? (isYearly ? addon.price * 12 : addon.price) : 0;
      return total + addonPrice;
    }, 0);

    // Setup fee is one-time, don't include in recurring total
    const setupFee = isResumeFlow ? 0 : plan.setupFee || 0;
    const recurringTotal = planPrice + addonTotal;

    return {
      recurringTotal,
      setupFee,
      totalToday: recurringTotal + setupFee,
    };
  };

  // Handle form submission
  const onSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      // If user is NOT logged in, check if email already exists
      if (!user) {
        try {
          const emailCheck = await checkEmailExists(formData.email);
          if (emailCheck.success && emailCheck.exists) {
            toast({
              title: "Login Required",
              description: "Please log in to continue with your purchase.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          } else if (!emailCheck.success) {
            // Handle validation errors but don't block checkout
            console.warn("Email validation warning:", emailCheck.error);
          }
        } catch (error) {
          console.error("Email check error:", error);
          // Continue with checkout if email check fails - don't block the user
        }
      }

      // Convert planId to the correct type
      const typedPlanId = planId as "basic" | "essential" | "pro";

      // Create checkout data based on user status
      let checkoutData;

      if (user) {
        // For logged-in users, no password needed
        checkoutData = {
          email: formData.email,
          username: formData.username,
          vatNumber:
            formData.invoiceType === "invoice" ? formData.vatNumber : "",
          city: formData.invoiceType === "invoice" ? formData.city : "",
          street: formData.invoiceType === "invoice" ? formData.street : "",
          number: formData.invoiceType === "invoice" ? formData.number : "",
          postalCode: formData.invoiceType === "invoice" ? formData.postalCode : "",
          invoiceType: formData.invoiceType,
          planId: typedPlanId,
          billingPeriod: formData.billingPeriod,
          addOns: selectedAddons
            .map((id) => AVAILABLE_ADDONS.find((addon) => addon.id === id)?.id)
            .filter((id): id is string => id !== undefined),
          isResume: isResume,
          language: i18n.language,
        };
      } else {
        // For new users, password is required
        if (!formData.password) {
          throw new Error("Password is required for new accounts");
        }

        checkoutData = {
          email: formData.email,
          username: formData.username,
          vatNumber:
            formData.invoiceType === "invoice" ? formData.vatNumber : "",
          city: formData.invoiceType === "invoice" ? formData.city : "",
          street: formData.invoiceType === "invoice" ? formData.street : "",
          number: formData.invoiceType === "invoice" ? formData.number : "",
          postalCode: formData.invoiceType === "invoice" ? formData.postalCode : "",
          invoiceType: formData.invoiceType,
          planId: typedPlanId,
          billingPeriod: formData.billingPeriod,
          password: formData.password, // Always include password for new users
          addOns: selectedAddons
            .map((id) => AVAILABLE_ADDONS.find((addon) => addon.id === id)?.id)
            .filter((id): id is string => id !== undefined),
          isResume: isResume,
          language: i18n.language,
        };
      }

      console.log("Checkout data:", checkoutData);

      const response = await createCheckoutSession(checkoutData);

      if (response.url) {
        window.location.href = response.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        className="mb-6 flex items-center"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> {t("preCheckout.backToPlans")}
      </Button>

      <h1 className="text-3xl font-bold mb-8">
        {t("preCheckout.title", {
          planName: planId.charAt(0).toUpperCase() + planId.slice(1),
        })}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column - User information and checkout */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t("preCheckout.yourInformation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className={user ? "opacity-50" : ""}>
                        <FormLabel>{t("preCheckout.email")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("preCheckout.emailPlaceholder")}
                            {...field}
                            disabled={!!user}
                            className={user ? "cursor-not-allowed" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className={user ? "opacity-50" : ""}>
                        <FormLabel>{t("preCheckout.username")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("preCheckout.usernamePlaceholder")}
                            {...field}
                            disabled={!!user}
                            className={user ? "cursor-not-allowed" : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!user && (
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("preCheckout.phoneOptional")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("preCheckout.phonePlaceholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="invoiceType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t("preCheckout.documentType")}</FormLabel>
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
                                {t("preCheckout.invoiceVatNeeded")}
                              </FormLabel>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="receipt" id="receipt" />
                              <FormLabel
                                htmlFor="receipt"
                                className="font-normal cursor-pointer"
                              >
                                {t("preCheckout.receiptNoVatNeeded")}
                              </FormLabel>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceType"
                    render={({ field }) => (
                      <>
                        {field.value === "invoice" && (
                          <>
                            <FormField
                              control={form.control}
                              name="vatNumber"
                              render={({ field: vatField }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t("preCheckout.vatNumber")}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={t(
                                        "preCheckout.vatNumberPlaceholder",
                                      )}
                                      {...vatField}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="city"
                                render={({ field: cityField }) => (
                                  <FormItem>
                                    <FormLabel>
                                      {t("preCheckout.city")}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t("preCheckout.cityPlaceholder")}
                                        {...cityField}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="street"
                                render={({ field: streetField }) => (
                                  <FormItem>
                                    <FormLabel>
                                      {t("preCheckout.street")}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t("preCheckout.streetPlaceholder")}
                                        {...streetField}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="number"
                                render={({ field: numberField }) => (
                                  <FormItem>
                                    <FormLabel>
                                      {t("preCheckout.number")}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t("preCheckout.numberPlaceholder")}
                                        {...numberField}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="postalCode"
                                render={({ field: postalCodeField }) => (
                                  <FormItem>
                                    <FormLabel>
                                      {t("preCheckout.postalCode")}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t("preCheckout.postalCodePlaceholder")}
                                        {...postalCodeField}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}
                  />

                  {!user && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("preCheckout.password")}</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={t("preCheckout.passwordPlaceholder")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="mt-6 pt-4 border-t">
                    <h3 className="font-medium mb-2">
                      {t("preCheckout.planDetails")}
                    </h3>

                    <div className="space-y-2">
                      {/* Plan name + price */}
                      <div className="flex justify-between">
                        <span>{plan.name}</span>
                        <span>
                          €{isYearly ? plan.yearlyPrice : plan.price}
                          {isYearly ? t("preCheckout.perYear") : t("preCheckout.perMonth")}
                        </span>
                      </div>

                      {/* Setup fee */}
                      {plan.setupFee > 0 && !isResumeFlow && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>
                            {t("preCheckout.setupFee")} ({t("preCheckout.oneTime")})
                          </span>
                          <span>€{plan.setupFee.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Total today */}
                      <div className="flex justify-between pt-2 border-t border-border mt-2 font-bold">
                        <span>{t("preCheckout.total")}</span>
                        <span>
                          €{calculateTotals().totalToday.toFixed(2)}
                          {plan.setupFee > 0 && !isResumeFlow
                            ? " " + t("preCheckout.today")
                            : (isYearly
                                ? t("preCheckout.perYear")
                                : t("preCheckout.perMonth"))}
                        </span>
                      </div>

                      {/* Recurring after today */}
                      {plan.setupFee > 0 && !isResumeFlow && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {t("preCheckout.then")} €{calculateTotals().recurringTotal.toFixed(2)}
                          {isYearly ? t("preCheckout.perYear") : t("preCheckout.perMonth")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 mt-6">
                    <Checkbox
                      id="privacy-policy"
                      checked={privacyAccepted}
                      onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                      data-testid="checkbox-privacy-policy"
                    />
                    <label
                      htmlFor="privacy-policy"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      {t("preCheckout.privacyPolicyAcceptance")}{" "}
                      <a
                        href="/legal/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:no-underline"
                      >
                        {t("preCheckout.privacyPolicyLink")}
                      </a>
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full mt-4 hidden md:block"
                    disabled={loading || !privacyAccepted}
                    data-testid="button-purchase"
                  >
                    {loading
                      ? t("preCheckout.processing")
                      : t("preCheckout.completePurchase")}
                  </Button>

                  <Button
                    type="submit"
                    className="w-full mt-4 md:hidden"
                    disabled={loading || !privacyAccepted}
                    data-testid="button-purchase-mobile"
                  >
                    {loading
                      ? t("preCheckout.processing")
                      : t("preCheckout.completePurchase")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Value Reinforcement */}
        <div className="space-y-6">
          {/* What You're Getting */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("preCheckout.youreGetting")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t("preCheckout.professionalWebsite")}</p>
                    <p className="text-sm text-muted-foreground">{t("preCheckout.professionalWebsiteDesc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t("preCheckout.hostingDomain")}</p>
                    <p className="text-sm text-muted-foreground">{t("preCheckout.hostingDomainDesc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t("preCheckout.ongoingUpdates")}</p>
                    <p className="text-sm text-muted-foreground">{t("preCheckout.ongoingUpdatesDesc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t("preCheckout.clientDashboard")}</p>
                    <p className="text-sm text-muted-foreground">{t("preCheckout.clientDashboardDesc")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Testimonial */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <p className="italic text-muted-foreground">
                  &ldquo;{t("preCheckout.testimonialQuote")}&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex text-yellow-500">
                    ★★★★★
                  </div>
                  <span className="text-sm font-medium">— {t("preCheckout.testimonialAuthor")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guarantee */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-2xl">🔒</span>
                  {t("preCheckout.guaranteeTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("preCheckout.guaranteeDescription")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PreCheckout() {
  const location = useLocation();
  const params = useParams();
  const queryParams = new URLSearchParams(location.search);
  const { t } = useTranslation();

  // Get planId from URL path parameter
  const planId = params.planId;
  const isYearly = queryParams.get("isYearly") === "true"; // Convert to boolean
  const isResume = queryParams.get("isResume") === "true"; // Check if this is a resume flow

  if (!planId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">
          {t("preCheckout.noPlanSelected")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("preCheckout.selectPlanFirst")}
        </p>
        <Button onClick={() => (window.location.href = "/")} className="mt-4">
          {t("preCheckout.viewPlans")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16 pb-24">
      <PreCheckoutPage
        planId={planId}
        isYearly={isYearly}
        isResume={isResume}
      />
    </div>
  );
}
