import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
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

export const GOALS = [
  "Get more enquiries",
  "Book more appointments",
  "Sell products online",
  "Showcase my work",
  "Build trust in my business",
  "Share information clearly",
  "Something else",
] as const;

export const PLANS = ["basic", "essential", "pro"] as const;

export const WIZARD_BILLING_PERIODS = ["monthly", "yearly"] as const;

const wizardSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES).optional(),
  goal: z.enum(GOALS).optional(),
  selectedDesign: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  subject: z.string().optional(),
  plan: z.enum(PLANS).optional(),
  billingPeriod: z.enum(WIZARD_BILLING_PERIODS).optional(),
});

export type WizardValues = z.infer<typeof wizardSchema>;

export default function GetStarted() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      businessType: undefined,
      goal: undefined,
      selectedDesign: undefined,
      fullName: "",
      email: "",
      subject: "",
      plan: "essential",
      billingPeriod: "monthly",
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

  const nextStep = () => setCurrentStep((s) => s + 1);
  const prevStep = () => setCurrentStep((s) => s - 1);

  const onSubmit = (values: WizardValues) => {
    // TODO: pass values to checkout flow
    console.log("wizard submit", values);
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
          className="fixed top-6 right-6 z-50 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border-0 cursor-pointer flex items-center justify-center transition-colors"
          aria-label={t("getStarted.cancelAriaLabel")}
        >
          <X className="w-4 h-4 text-white/60" />
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
                navigate("/");
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
