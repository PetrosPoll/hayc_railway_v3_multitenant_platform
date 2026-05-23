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
import StepIntro from "@/components/get-started/step-intro";
import StepBusinessType from "@/components/get-started/step-business-type";
import StepGoal from "@/components/get-started/step-goal";
import StepRecommendation from "@/components/get-started/step-recommendation";
import StepChooseDesign from "@/components/get-started/step-choose-design";
import StepSummary from "@/components/get-started/step-summary";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import { checkEmailExists } from "@/lib/api";
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
  plan: z.enum(PLANS).optional(),
  billingPeriod: z.enum(WIZARD_BILLING_PERIODS).optional(),
  addOns: z.array(z.string()).optional(),
  suggestedAddons: z.array(z.string()).optional(),
  selectedAddons: z.array(z.string()).optional(),
  suggestedStructure: z.array(z.string()).optional(),
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
  book_appointments: ["Booking Integration"],
  sell_products: ["HDP"],
  showcase_work: [],
  build_trust: [],
  share_information: [],
  something_else: [],
};

const BUSINESS_TYPE_ADDON_MAP: Record<string, string[]> = {
  local_business: ["Booking Integration"],
  service_business: ["Booking Integration"],
  personal_brand: [],
  creative_business: ["HDP"],
  online_store: ["HDP"],
  hospitality_travel: ["Booking Integration"],
  health_wellness: ["Booking Integration"],
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

  suggested.add("Booking Integration");

  return Array.from(suggested);
}

export default function GetStarted() {
  const { t, i18n } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: sessionUser } = useAuth();
  const isLoggedIn = !!sessionUser;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);


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
      plan: "essential",
      billingPeriod: "monthly",
      addOns: [],
      suggestedAddons: [],
      selectedAddons: [],
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

    if (currentStep === 1) {
      persistPreCheckout({
        businessType: values.businessType,
        businessTypeOtherDetails: values.businessTypeOtherDetails,
      });
    } else if (currentStep === 2) {
      persistPreCheckout({
        goals: values.goals,
        goalOtherDetails: values.goalOtherDetails,
      });
    } else if (currentStep === 3) {
      const step3Values = form.getValues();

      const suggestedStructure = computeSuggestedStructure(
        step3Values.businessType,
        step3Values.goals ?? [],
      );

      const currentSuggested = computeSuggestedAddons(
        step3Values.businessType,
        step3Values.goals ?? [],
      );
      const currentSelected = step3Values.selectedAddons ?? [];

      const finalSelectedAddons = currentSelected.length > 0
        ? currentSelected
        : currentSuggested;

      form.setValue("suggestedStructure", suggestedStructure);
      form.setValue("suggestedAddons", currentSuggested);
      form.setValue("selectedAddons", finalSelectedAddons);

      persistPreCheckout({
        suggestedStructure,
        suggestedAddons: currentSuggested,
        selectedAddons: finalSelectedAddons,
      });
    } else if (currentStep === 4) {
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

  const onSubmit = async (values: WizardValues) => {
    const plan = values.plan ?? "essential";
    const billingPeriod = values.billingPeriod ?? "monthly";
    const email = sessionUser?.email ?? values.email ?? "";
    const fullName = sessionUser?.username ?? values.fullName ?? "";

    if (!isLoggedIn) {
      if (!email) {
        toast({ title: t("getStarted.errors.emailRequired"), variant: "destructive" });
        return;
      }
      if (!fullName) {
        toast({ title: t("getStarted.errors.nameRequired"), variant: "destructive" });
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

      try {
        const emailCheck = await checkEmailExists(email);
        if (emailCheck.success && emailCheck.exists) {
          toast({
            title: "Account already exists",
            description: "This email is registered. Sign in to continue, or use another email.",
            variant: "destructive",
          });
          return;
        }
      } catch (e) {
        console.warn("Email check error:", e);
      }
    }

    if (!values.privacyAccepted && !isLoggedIn) return;

    persistPreCheckout({
      plan: values.plan,
      billingPeriod: values.billingPeriod,
      fullName: values.fullName,
      email: values.email,
    });

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
          addOns: values.addOns ?? [],
          language: i18n.language,
        }),
      });

      if (!response.ok) throw new Error("Failed to create checkout session");
      const data = await response.json();
      if (!data.url) throw new Error("No checkout URL received");
      if (data.sessionId) {
        localStorage.setItem("hayc_gs_session_id", data.sessionId);
      }
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
          <StepIntro onNext={nextStep} />
        );
      case 1:
        return (
          <StepBusinessType
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 2:
        return (
          <StepGoal
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 3:
        return (
          <StepRecommendation
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 4:
        return (
          <StepChooseDesign
            form={form}
            onNext={nextStep}
            onBack={prevStep}
          />
        );
      case 5:
        return (
          <StepSummary
            form={form}
            onBack={prevStep}
            onSubmit={form.handleSubmit(onSubmit)}
            isLoggedIn={isLoggedIn}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {/* Cancel button — visible from step 1 onwards */}
      {currentStep > 0 && (
        <button
          type="button"
          onClick={() => setShowExitModal(true)}
          className="fixed top-6 left-6 z-50 h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 border-0 cursor-pointer flex items-center justify-center transition-colors"
        >
          <span className="text-white/60 text-sm font-medium font-['Montserrat'] hover:text-white/90 transition-colors">
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

      <Dialog open={showExitModal} onOpenChange={setShowExitModal}>
        <DialogContent
          className="bg-[#111111] border border-zinc-800 text-white font-['Montserrat'] max-w-md rounded-2xl sm:rounded-lg"
          closeBtnClassName="border-white/30 bg-white/15 text-white shadow-md hover:bg-white/25 hover:text-white hover:opacity-100 focus-visible:ring-[#ED4C14]/60 focus-visible:ring-offset-[#111111]"
        >
          <DialogHeader className="gap-3 text-center sm:text-left pt-8 sm:pt-2 pr-14 sm:pr-4">
            <DialogTitle className="text-white text-xl font-semibold font-['Montserrat']">
              {t("getStarted.exitModal.title")}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm font-normal font-['Montserrat'] leading-6">
              {t("getStarted.exitModal.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowExitModal(false)}
              className="h-10 px-5 rounded-[10px] border border-white/30 bg-transparent text-white text-sm font-semibold font-['Montserrat'] cursor-pointer hover:bg-white/10 transition-colors"
            >
              {t("getStarted.exitModal.keepGoing")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowExitModal(false);
                navigate(isLoggedIn ? "/dashboard" : "/");
              }}
              className="h-10 px-5 rounded-[10px] bg-[#ED4C14] border-0 text-white text-sm font-semibold font-['Montserrat'] cursor-pointer hover:bg-[#d44310] transition-colors"
            >
              {t("getStarted.exitModal.leaveAnyway")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
