import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StepBusinessType from "@/components/get-started/step-business-type";
import StepGoal from "@/components/get-started/step-goal";
import StepRecommendation from "@/components/get-started/step-recommendation";
import StepChooseDesign from "@/components/get-started/step-choose-design";
import StepSummary from "@/components/get-started/step-summary";
import StepPricing from "@/components/get-started/step-pricing";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import { checkEmailExists } from "@/lib/api";
import { enforceSingleBookingAddon } from "@/lib/get-started-addons";
// import { StepBusinessType } from "@/pages/get-started/steps/step-business-type";
// import { StepGoal } from "@/pages/get-started/steps/step-goal";
// import { StepRecommendation } from "@/pages/get-started/steps/step-recommendation";
// import { StepChooseDesign } from "@/pages/get-started/steps/step-choose-design";
// import { StepSummary } from "@/pages/get-started/steps/step-summary";

export const BUSINESS_TYPES = [
  "Local Business",
  "Service Business",
  "Personal Brand",
  "Creative Business",
  "Online Store",
  "Hospitality/Travel",
  "Health/Wellness",
  "Other",
] as const;

/** Selecting this on the business-type step shows a free-text field. */
export const BUSINESS_TYPE_OTHER = "Other" as (typeof BUSINESS_TYPES)[number];

export const GOALS = [
  "Get more enquiries",
  "Book more appointments",
  "Sell products online",
  "Showcase my work",
  "Build trust in my business",
  "Share information clearly",
  "Something else",
] as const;

/** Selecting this on the goal step clears other goals and shows a free-text field. */
export const GOAL_SOMETHING_ELSE =
  "Something else" as (typeof GOALS)[number];

export const PLANS = ["basic", "essential", "pro"] as const;

export const WIZARD_BILLING_PERIODS = ["monthly", "yearly"] as const;

const wizardSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES).optional(),
  businessTypeOtherDetails: z.string().optional(),
  goals: z.array(z.enum(GOALS)).optional(),
  goalOtherDetails: z.string().optional(),
  selectedDesign: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().optional(),
  documentType: z.enum(["invoice", "receipt"]).optional().default("receipt"),
  vatNumber: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  postalCode: z.string().optional(),
  privacyAccepted: z.boolean().optional().default(false),
  newsletterOptIn: z.boolean().optional().default(false),
  plan: z.enum(PLANS).optional(),
  billingPeriod: z.enum(WIZARD_BILLING_PERIODS).optional(),
  addOns: z.array(z.string()).optional(),
  suggestedAddons: z.array(z.string()).optional(),
  selectedAddons: z.array(z.string()).optional(),
  suggestedStructure: z.array(z.string()).optional(),
  speedUpDev: z.boolean().optional().default(false),
});

export type WizardValues = z.infer<typeof wizardSchema>;

const GOAL_PAGE_MAP: Record<string, string[]> = {
  get_enquiries: ["Contact"],
  book_appointments: ["Booking"],
  sell_products: ["Products", "Pricing"],
  showcase_work: ["Gallery"],
  build_trust: ["Testimonials"],
  share_information: ["Blog"],
  something_else: [],
};

const BUSINESS_TYPE_PAGE_MAP: Record<string, string[]> = {
  local_business: ["Home", "About", "Services", "Contact"],
  service_business: ["Home", "About", "Services", "Contact"],
  personal_brand: ["Home", "About", "Blog", "Contact"],
  creative_business: ["Home", "About", "Gallery", "Contact"],
  online_store: ["Home", "Products", "Pricing", "Contact"],
  hospitality_travel: ["Home", "About", "Booking", "Contact", "Location"],
  health_wellness: ["Home", "About", "Services", "Booking", "Contact"],
  other: ["Home", "About", "Services", "Contact"],
};

const BUSINESS_TYPE_DISPLAY_MAP: Record<string, string> = {
  "Local Business": "local_business",
  "Service Business": "service_business",
  "Personal Brand": "personal_brand",
  "Creative Business": "creative_business",
  "Online Store": "online_store",
  "Hospitality/Travel": "hospitality_travel",
  "Health/Wellness": "health_wellness",
  "Other": "other",
};

const GOAL_DISPLAY_MAP: Record<string, string> = {
  "Get more enquiries": "get_enquiries",
  "Book more appointments": "book_appointments",
  "Sell products online": "sell_products",
  "Showcase my work": "showcase_work",
  "Build trust in my business": "build_trust",
  "Share information clearly": "share_information",
  "Something else": "something_else",
};

function computeSuggestedStructure(
  businessType: string | undefined,
  goals: string[] | undefined,
): string[] {
  const pages = new Set<string>();

  const btKey = BUSINESS_TYPE_DISPLAY_MAP[businessType ?? ""] ?? businessType ?? "";
  (BUSINESS_TYPE_PAGE_MAP[btKey] ?? ["Home", "About", "Services", "Contact"]).forEach(
    (p) => pages.add(p),
  );

  (goals ?? [])
    .filter((g) => g !== "something_else" && g !== "Something else")
    .forEach((goal) => {
      const goalKey = GOAL_DISPLAY_MAP[goal] ?? goal;
      (GOAL_PAGE_MAP[goalKey] ?? []).forEach((p) => pages.add(p));
    });

  return Array.from(pages);
}

const GOAL_ADDON_MAP: Record<string, string[]> = {
  get_enquiries: [],
  book_appointments: ["Services Booking"],
  sell_products: ["Online Courses"],
  showcase_work: [],
  build_trust: [],
  share_information: [],
  something_else: [],
};

const BUSINESS_TYPE_ADDON_MAP: Record<string, string[]> = {
  local_business: ["Services Booking"],
  service_business: ["Services Booking"],
  personal_brand: [],
  creative_business: ["Online Courses"],
  online_store: ["Online Courses"],
  hospitality_travel: ["Tours & Transfers"],
  health_wellness: ["Services Booking"],
  other: [],
};

function computeSuggestedAddons(
  businessType: string | undefined,
  goals: string[] | undefined,
): string[] {
  const suggested = new Set<string>();

  const btKey = BUSINESS_TYPE_DISPLAY_MAP[businessType ?? ""] ?? businessType ?? "";
  (BUSINESS_TYPE_ADDON_MAP[btKey] ?? []).forEach((a) => suggested.add(a));

  (goals ?? [])
    .filter((g) => g !== "something_else" && g !== "Something else")
    .forEach((goal) => {
      const goalKey = GOAL_DISPLAY_MAP[goal] ?? goal;
      (GOAL_ADDON_MAP[goalKey] ?? []).forEach((a) => suggested.add(a));
    });

  if (suggested.size === 0) {
    suggested.add("Services Booking");
  }

  return enforceSingleBookingAddon(Array.from(suggested));
}

export default function GetStarted() {
  const { t, i18n } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showBrowserBackModal, setShowBrowserBackModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: sessionUser } = useAuth();
  const isLoggedIn = !!sessionUser;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentStepRef = useRef(0);
  const allowUnloadRef = useRef(false);

  currentStepRef.current = currentStep;


  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      businessType: undefined,
      businessTypeOtherDetails: "",
      goals: [],
      goalOtherDetails: "",
      selectedDesign: undefined,
      fullName: "",
      email: "",
      phone: "",
      password: "",
      documentType: "receipt",
      vatNumber: "",
      city: "",
      street: "",
      streetNumber: "",
      postalCode: "",
      privacyAccepted: false,
      newsletterOptIn: false,
      plan: "essential",
      billingPeriod: "monthly",
      addOns: [],
      suggestedAddons: [],
      selectedAddons: undefined,
      suggestedStructure: [],
    },
  });

  const { setValue } = form;

  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (
      planParam === "basic" ||
      planParam === "essential" ||
      planParam === "pro"
    ) {
      setValue("plan", planParam);
    }
    const billingParam = searchParams.get("billing");
    if (billingParam === "monthly" || billingParam === "yearly") {
      setValue("billingPeriod", billingParam);
    }
    const stepParam = searchParams.get("step");
    if (stepParam !== null) {
      const stepNum = parseInt(stepParam, 10);
      if (!isNaN(stepNum) && stepNum >= 0 && stepNum <= 5) {
        setCurrentStep(stepNum);
      }
    }
  }, [searchParams, setValue]);

  useEffect(() => {
    if (!sessionUser) return;
    if (sessionUser.email) {
      setValue("email", sessionUser.email);
    }
    if (sessionUser.username) {
      setValue("fullName", sessionUser.username);
    }
  }, [sessionUser, setValue]);

  // Block browser / mobile system back; ask users to use the in-app Back button.
  useEffect(() => {
    window.history.pushState({ haycGetStartedGuard: true }, "");

    const onPopState = () => {
      window.history.pushState({ haycGetStartedGuard: true }, "");
      if (currentStepRef.current > 0) {
        setShowBrowserBackModal(true);
      } else {
        setShowExitModal(true);
      }
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const persistPreCheckout = (patch: Partial<WizardValues> & Record<string, unknown>) => {
    try {
      const key = "hayc_gs_pre_checkout";
      const existing = localStorage.getItem(key);
      const current = existing ? JSON.parse(existing) : {};
      localStorage.setItem(
        key,
        JSON.stringify({ ...current, ...patch }),
      );
    } catch (e) {
      console.warn("Failed to persist pre-checkout data", e);
    }
  };

  const nextStep = () => {
    const values = form.getValues();

    if (currentStep === 0) {
      persistPreCheckout({
        businessType: values.businessType,
        businessTypeOtherDetails: values.businessTypeOtherDetails,
      });
    } else if (currentStep === 1) {
      persistPreCheckout({
        goals: values.goals,
        goalOtherDetails: values.goalOtherDetails,
      });
    } else if (currentStep === 2) {
      const step3Values = form.getValues();

      const suggestedStructure = computeSuggestedStructure(
        step3Values.businessType,
        step3Values.goals ?? [],
      );

      const currentSuggested = computeSuggestedAddons(
        step3Values.businessType,
        step3Values.goals ?? [],
      );
      const currentSelected = step3Values.selectedAddons;

      const finalSelectedAddons = enforceSingleBookingAddon(
        currentSelected !== undefined ? currentSelected : currentSuggested,
      );

      form.setValue("suggestedStructure", suggestedStructure);
      form.setValue("suggestedAddons", currentSuggested);
      form.setValue("selectedAddons", finalSelectedAddons);

      persistPreCheckout({
        suggestedStructure,
        suggestedAddons: currentSuggested,
        selectedAddons: finalSelectedAddons,
      });
    } else if (currentStep === 3) {
      const selectedId = values.selectedDesign;
      const template =
        selectedId && selectedId !== "auto"
          ? ENVATO_TEMPLATES.find((t) => String(t.id) === selectedId)
          : null;

      persistPreCheckout({
        selectedDesign: selectedId,
        selectedTemplateName: template?.name ?? null,
        selectedTemplatePreview: template?.preview ?? null,
      });
    }

    setCurrentStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setCurrentStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Called when the user completes the account step (step 4).
   * Runs field validation and an async email-existence check before advancing to step 5.
   */
  const onAccountComplete = async () => {
    const values = form.getValues();

    if (!isLoggedIn) {
      const email = values.email ?? "";
      const fullName = values.fullName ?? "";

      if (!fullName.trim()) {
        toast({ title: t("getStarted.errors.nameRequired"), variant: "destructive" });
        return;
      }
      if (!email.trim()) {
        toast({ title: t("getStarted.errors.emailRequired"), variant: "destructive" });
        return;
      }
      if (!values.password) {
        toast({ title: t("getStarted.errors.passwordRequired"), variant: "destructive" });
        return;
      }
      const pwReqs = [
        values.password.length >= 8,
        /[A-Z]/.test(values.password),
        /[0-9]/.test(values.password),
        /[^A-Za-z0-9]/.test(values.password),
      ];
      if (!pwReqs.every(Boolean)) {
        toast({ title: t("getStarted.errors.passwordWeak"), variant: "destructive" });
        return;
      }
      if (!values.privacyAccepted) {
        toast({ title: t("getStarted.errors.privacyRequired"), variant: "destructive" });
        return;
      }
      if (values.documentType === "invoice") {
        if (!values.vatNumber?.trim()) {
          toast({ title: t("getStarted.errors.vatRequired"), variant: "destructive" });
          return;
        }
        if (!values.city?.trim() || !values.street?.trim() || !values.streetNumber?.trim() || !values.postalCode?.trim()) {
          toast({ title: t("getStarted.errors.addressRequired"), variant: "destructive" });
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const emailCheck = await checkEmailExists(email);
        if (emailCheck.success && emailCheck.exists) {
          toast({
            title: "Unable to continue",
            description: "If you have an existing account, please sign in. Otherwise, try a different email.",
            variant: "destructive",
          });
          return;
        }
      } catch (e) {
        console.warn("Email check error:", e);
      } finally {
        setIsSubmitting(false);
      }
    }

    nextStep();
  };

  /** Called at step 5 — account was already validated in onAccountComplete. */
  const onSubmit = async (values: WizardValues) => {
    const plan = values.plan ?? "essential";
    const billingPeriod = values.billingPeriod ?? "monthly";
    const email = sessionUser?.email ?? values.email ?? "";
    const fullName = sessionUser?.username ?? values.fullName ?? "";

    persistPreCheckout({
      plan: values.plan,
      billingPeriod: values.billingPeriod,
      fullName: values.fullName,
      email: values.email,
    });

    if (values.newsletterOptIn && email) {
      fetch("/api/hayc/newsletter-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/public/get-started", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          phone: values.phone || undefined,
          password: !isLoggedIn ? values.password : undefined,
          planId: plan,
          billingPeriod,
          invoiceType: values.documentType ?? "receipt",
          vatNumber: values.documentType === "invoice" ? (values.vatNumber ?? "") : "",
          city: values.documentType === "invoice" ? (values.city ?? "") : "",
          street: values.documentType === "invoice" ? (values.street ?? "") : "",
          streetNumber: values.documentType === "invoice" ? (values.streetNumber ?? "") : "",
          postalCode: values.documentType === "invoice" ? (values.postalCode ?? "") : "",
          addOns: values.selectedAddons ?? [],
          language: i18n.language,
          speedUpDev: values.speedUpDev ?? false,
        }),
      });

      if (!response.ok) throw new Error("Failed to create checkout session");
      const data = await response.json();
      if (!data.url) throw new Error("No checkout URL received");
      if (data.sessionId) {
        localStorage.setItem("hayc_gs_session_id", data.sessionId);
      }
      allowUnloadRef.current = true;
      window.location.href = data.url;
    } catch (error) {
      console.error("Get-started submit error:", error);
      toast({
        title: t("getStarted.errors.checkoutFailed"),
        description: t("getStarted.errors.checkoutFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepBusinessType
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 1:
        return (
          <StepGoal
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 2:
        return (
          <StepRecommendation
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 3:
        return (
          <StepChooseDesign
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 4:
        return (
          <StepSummary
            form={form}
            onBack={prevStep}
            onSubmit={onAccountComplete}
            isLoggedIn={isLoggedIn}
            isSubmitting={isSubmitting}
          />
        );
      case 5:
        return (
          <StepPricing
            form={form}
            onBack={prevStep}
            onSubmit={form.handleSubmit(onSubmit)}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {currentStep !== 5 && (
        <button
          type="button"
          onClick={() => setShowExitModal(true)}
          className="fixed top-4 right-4 md:top-6 md:left-4 md:right-auto z-50 h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 border-0 cursor-pointer flex items-center justify-center transition-colors"
        >
          <span className="text-white/60 text-sm font-medium font-brand hover:text-white/90 transition-colors">
            {t("getStarted.justBrowsing")}
          </span>
        </button>
      )}
      <div className="min-h-screen bg-black">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {renderStepContent()}
          </form>
        </Form>
      </div>

      <Dialog open={showExitModal} onOpenChange={(open) => { if (!open) setShowExitModal(false); }}>
        <DialogContent
          className="bg-[#111111] border border-zinc-800 text-white font-brand max-w-md rounded-2xl sm:rounded-lg"
          closeBtnClassName="border-white/30 bg-white/15 text-white shadow-md hover:bg-white/25 hover:text-white hover:opacity-100 focus-visible:ring-[#ED4C14]/60 focus-visible:ring-offset-[#111111]"
        >
          <DialogHeader className="gap-3 text-center pt-2 pr-14">
            <DialogTitle className="text-white text-xl font-semibold font-brand">
              {t("getStarted.exitModal.title")}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm font-normal font-brand leading-6">
              {t("getStarted.exitModal.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowExitModal(false)}
              className="h-11 w-full sm:w-auto px-5 rounded-[10px] border border-white/30 bg-transparent text-white text-sm font-semibold font-brand cursor-pointer hover:bg-white/10 transition-colors"
            >
              {t("getStarted.exitModal.keepGoing")}
            </button>
            <button
              type="button"
              onClick={() => {
                allowUnloadRef.current = true;
                navigate(isLoggedIn ? "/dashboard" : "/");
              }}
              className="h-11 w-full sm:w-auto px-5 rounded-[10px] bg-[#ED4C14] border-0 text-white text-sm font-semibold font-brand cursor-pointer hover:bg-[#d44310] transition-colors"
            >
              {t("getStarted.exitModal.leaveAnyway")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBrowserBackModal}
        onOpenChange={(open) => {
          if (!open) setShowBrowserBackModal(false);
        }}
      >
        <DialogContent
          className="bg-[#111111] border border-zinc-800 text-white font-brand max-w-md rounded-2xl sm:rounded-lg"
          closeBtnClassName="border-white/30 bg-white/15 text-white shadow-md hover:bg-white/25 hover:text-white hover:opacity-100 focus-visible:ring-[#ED4C14]/60 focus-visible:ring-offset-[#111111]"
        >
          <DialogHeader className="gap-3 text-center pt-2 pr-14">
            <DialogTitle className="text-white text-xl font-semibold font-brand">
              {t("getStarted.browserBackModal.title", {
                defaultValue: "Use the Back button on the page",
              })}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm font-normal font-brand leading-6">
              {t("getStarted.browserBackModal.description", {
                defaultValue:
                  "Browser or phone back isn't supported during setup. To go to the previous step, press the Back button at the bottom left of the page.",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowBrowserBackModal(false)}
              className="h-11 w-full sm:w-auto px-5 rounded-[10px] bg-[#ED4C14] border-0 text-white text-sm font-semibold font-brand cursor-pointer hover:bg-[#d44310] transition-colors"
            >
              {t("getStarted.browserBackModal.gotIt", { defaultValue: "Got it" })}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

