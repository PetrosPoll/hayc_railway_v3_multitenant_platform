import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SELF_DESCRIPTION_VALUES = [
  "know_exactly",
  "rough_idea",
  "need_guidance",
] as const;

const CONCERN_VALUES = [
  "getting_done_fast",
  "making_it_look_right",
  "technical_side",
  "bringing_clients",
  "the_cost",
] as const;

const HEARD_ABOUT_VALUES = [
  "instagram",
  "tiktok",
  "youtube",
  "google",
  "referral",
  "other",
] as const;

export default function GetStartedQuickQuestions() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isMock = import.meta.env.DEV && searchParams.get("mock") === "true";
  const mockSessionId = "mock-session-id-dev";
  const sessionId =
    isMock
      ? mockSessionId
      : (searchParams.get("s") ?? "");

  const [selfDescription, setSelfDescription] = useState<string | null>(null);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [heardAbout, setHeardAbout] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const s = location.state?.submission;
    if (!s) return;
    if (s.selfDescription) setSelfDescription(s.selfDescription);
    if (s.biggestConcerns && Array.isArray(s.biggestConcerns)) {
      setConcerns(s.biggestConcerns);
    }
    if (s.heardAboutUs && Array.isArray(s.heardAboutUs)) {
      setHeardAbout(s.heardAboutUs);
    }
  }, [location.state]);

  if (!isMock && !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white font-brand">{t("getStarted.quickQuestions.loading")}</p>
      </div>
    );
  }

  const toggleMulti = (
    value: string,
    current: string[],
    setter: (v: string[]) => void,
  ) => {
    setter(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  };

  const [missingFields, setMissingFields] = useState<string[]>([]);

  const getMissingFieldLabels = (): string[] => {
    const missing: string[] = [];
    if (!selfDescription) missing.push(t("getStarted.quickQuestions.sections.selfDescription"));
    if (concerns.length === 0) missing.push(t("getStarted.quickQuestions.sections.biggestConcern"));
    return missing;
  };

  const handleNext = async () => {
    const missing = getMissingFieldLabels();
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    if (isMock) {
      navigate(`/get-started/onboarding/website-structure?mock=true`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/get-started/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          selfDescription,
          biggestConcerns: concerns,
          heardAboutUs: heardAbout,
          currentStep: 8,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      navigate(`/get-started/onboarding/website-structure?s=${sessionId}`);
    } catch (err) {
      console.error(err);
      toast({ title: t("getStarted.quickQuestions.errors.saveFailed"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLater = async () => {
    if (isMock) {
      navigate("/dashboard");
      return;
    }
    try {
      const payload = {
        selfDescription: selfDescription || null,
        biggestConcerns: concerns,
        heardAboutUs: heardAbout,
        currentStep: 7,
      };
      const body = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined && v !== null),
      );
      await fetch(`/api/get-started/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn("Save later failed silently:", err);
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col md:flex-row overflow-x-hidden">
      <div className="flex-1 flex flex-col justify-between px-4 md:px-[70px] py-8 md:py-[50px] gap-8 md:gap-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-white text-2xl md:text-4xl font-semibold font-brand">
            {t("getStarted.quickQuestions.title")}
          </h1>
          <p className="text-white text-base leading-[160%] font-brand">
            {t("getStarted.quickQuestions.subtitle")}
          </p>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <p className="text-[#eff6ff] text-lg font-medium font-brand">
              {t("getStarted.quickQuestions.sections.selfDescription")}
            </p>
            <div className="flex flex-wrap gap-2">
              {SELF_DESCRIPTION_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelfDescription(value)}
                  className={cn(
                    "px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
                    selfDescription === value
                      ? "bg-[#ED4C14] border-[#ED4C14]"
                      : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                  )}
                >
                  {t(`getStarted.quickQuestions.selfDescriptionOptions.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <p className="text-[#eff6ff] text-lg font-medium font-brand">
              {t("getStarted.quickQuestions.sections.biggestConcern")}
            </p>
            <div className="flex flex-wrap gap-2">
              {CONCERN_VALUES.map((value) => {
                const isSelected = concerns.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleMulti(value, concerns, setConcerns)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#ED4C14] border-[#ED4C14]"
                        : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-white border-white"
                          : "bg-transparent border-white/50",
                      )}
                    >
                      {isSelected && (
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path
                            d="M1 3.5L3 5.5L7 1"
                            stroke="#ED4C14"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    {t(`getStarted.quickQuestions.concernOptions.${value}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 py-6">
            <p className="text-[#eff6ff] text-lg font-medium font-brand">
              {t("getStarted.quickQuestions.sections.heardAbout")}
            </p>
            <div className="flex flex-wrap gap-2">
              {HEARD_ABOUT_VALUES.map((value) => {
                const isSelected = heardAbout.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleMulti(value, heardAbout, setHeardAbout)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#ED4C14] border-[#ED4C14]"
                        : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-white border-white"
                          : "bg-transparent border-white/50",
                      )}
                    >
                      {isSelected && (
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path
                            d="M1 3.5L3 5.5L7 1"
                            stroke="#ED4C14"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    {t(`getStarted.quickQuestions.heardAboutOptions.${value}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="w-full md:w-1/3 h-11 px-5 bg-[#ED4C14] rounded-[10px] flex items-center justify-center text-white text-base font-semibold font-brand leading-5 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("getStarted.quickQuestions.buttons.saving") : t("getStarted.quickQuestions.buttons.next")}
          </button>
          <button
            type="button"
            onClick={handleSaveLater}
            className="w-full md:w-auto h-11 px-5 rounded-[10px] flex items-center justify-center border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
          >
            <span className="text-white text-base font-semibold font-brand leading-5">
              {t("getStarted.quickQuestions.buttons.completeLater")}
            </span>
          </button>
        </div>
      </div>

      <Dialog open={missingFields.length > 0} onOpenChange={(open) => { if (!open) setMissingFields([]); }}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white max-w-sm rounded-2xl sm:rounded-lg">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-white font-brand">
              <AlertCircle className="w-5 h-5 text-[#ED4C14] flex-shrink-0" />
              {t("getStarted.summary.missingFieldsTitle", "Please fill in the required fields")}
            </DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col gap-2 mt-2">
            {missingFields.map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm font-brand text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ED4C14] flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setMissingFields([])}
            className="mt-4 w-full h-10 bg-[#ED4C14] rounded-[10px] text-white text-sm font-semibold font-brand border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
          >
            {t("getStarted.summary.missingFieldsDismiss", "Got it")}
          </button>
        </DialogContent>
      </Dialog>

      <div className="flex w-full md:w-[661px] md:min-h-screen bg-[#fcf6ee] items-center justify-center p-4 md:p-[10px] py-8 md:py-[10px]">
        <div className="w-full md:w-[565px] rounded-[20px] bg-[#fefaf7] border border-[#f6efe8] shadow-[0_0_12px_#e0dbd4] p-5 md:p-[25px] flex flex-col gap-6 md:gap-12">
          <div className="flex flex-col gap-6 px-5">
            <span className="text-[#ED4C14] text-sm font-semibold tracking-[0.02em] font-brand uppercase">
              {t("getStarted.quickQuestions.panel.eyebrow")}
            </span>
            <div className="flex flex-col gap-3">
              <h2 className="text-black text-2xl font-medium font-brand">
                {t("getStarted.quickQuestions.panel.title")}
              </h2>
              <p className="text-black text-base leading-[160%] font-brand">
                {t("getStarted.quickQuestions.panel.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex flex-col px-[41px] gap-0">
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="rounded-full border border-[#e0dbd4] p-1">
                  <div className="h-[27px] w-[27px] rounded-full bg-[#ED4C14] flex items-center justify-center">
                    <span className="text-[#eff6ff] text-sm font-medium font-brand">1</span>
                  </div>
                </div>
                <div className="w-px flex-1 min-h-[40px] bg-[#e0dbd4]" />
              </div>
              <div className="flex flex-col gap-1 pb-8 pt-1">
                <span className="text-black text-sm font-semibold tracking-[0.02em] font-brand">
                  {t("getStarted.quickQuestions.panel.steps.step1.title")}
                </span>
                <span className="text-black text-sm leading-[22px] font-brand">
                  {t("getStarted.quickQuestions.panel.steps.step1.subtitle")}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="rounded-full border border-[#e0dbd4] p-1">
                  <div className="h-[27px] w-[27px] rounded-full bg-[#ED4C14] flex items-center justify-center">
                    <span className="text-[#eff6ff] text-sm font-medium font-brand">2</span>
                  </div>
                </div>
                <div className="w-px flex-1 min-h-[40px] bg-[#e0dbd4]" />
              </div>
              <div className="flex flex-col gap-1 pb-8 pt-1">
                <span className="text-black text-sm font-semibold tracking-[0.02em] font-brand">
                  {t("getStarted.quickQuestions.panel.steps.step2.title")}
                </span>
                <span className="text-black text-sm leading-[22px] font-brand">
                  {t("getStarted.quickQuestions.panel.steps.step2.subtitle")}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="rounded-full border border-[#e0dbd4] p-1">
                  <div className="h-[27px] w-[27px] rounded-full bg-[#ED4C14] flex items-center justify-center">
                    <span className="text-[#eff6ff] text-sm font-medium font-brand">3</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-black text-sm font-semibold tracking-[0.02em] font-brand">
                  {t("getStarted.quickQuestions.panel.steps.step3.title")}
                </span>
                <span className="text-black text-sm leading-[22px] font-brand">
                  {t("getStarted.quickQuestions.panel.steps.step3.subtitle")}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-[#f6efe8]" />

          <div className="flex items-center gap-[18px] px-5">
            <img
              src="https://res.cloudinary.com/dem12vqtl/image/upload/v1779290519/simple_star_orange_yl9vsq.svg"
              alt=""
              className="w-5 h-5 flex-shrink-0"
            />
            <p className="text-black text-sm leading-[22px] font-brand">
              {t("getStarted.quickQuestions.panel.footer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

