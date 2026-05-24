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

const HAD_WEBSITE_VALUES = [
  "yes_worked_well",
  "yes_no_results",
  "no_first_time",
] as const;

const PLATFORM_VALUES = [
  "wix",
  "squarespace",
  "wordpress",
  "webflow",
  "someone_built_it",
  "other",
] as const;

const TRACKER_ITEMS = [
  {
    number: 1,
    key: "businessDetails",
    icon: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286699/building_lyqioo.svg",
  },
  {
    number: 2,
    key: "services",
    icon: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286706/briefcase_ljddhi.svg",
  },
  {
    number: 3,
    key: "previousWebsite",
    icon: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286700/cmd-icon_vunwc0.svg",
  },
  {
    number: 4,
    key: "nextStep",
    icon: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286701/right-up-arrow_ylqa9n.svg",
  },
];

type BadgeStatus = "in_progress" | "waiting" | "optional" | "completed" | "next";

const BADGE_ICONS = {
  in_progress: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286554/Time_Circle_asvscc.svg",
  waiting: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286705/minus-cirlce_m954j7.svg",
  optional: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286702/dotted-cirlce_oeywax.svg",
  completed: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779287944/circle_check_white_lpwfgx.svg",
  next: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286706/right-arrow_zkh4dv.svg",
};

const BADGE_STYLE: Record<BadgeStatus, { bg: string; textColor: string }> = {
  in_progress: { bg: "#fef0e3", textColor: "#ED4C14" },
  waiting: { bg: "#f4efea", textColor: "#000000" },
  optional: { bg: "#f4efea", textColor: "#000000" },
  completed: { bg: "#ED4C14", textColor: "#ffffff" },
  next: { bg: "#fef0e3", textColor: "#ED4C14" },
};

function TrackerBadge({ status }: { status: BadgeStatus }) {
  const { t } = useTranslation();
  const { bg, textColor } = BADGE_STYLE[status];
  const icon = BADGE_ICONS[status];
  const isNext = status === "next";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: bg }}
    >
      {!isNext && <img src={icon} alt="" className="w-[15px] h-[15px]" />}
      <span
        className="text-xs font-medium font-brand leading-[22px] whitespace-nowrap"
        style={{ color: textColor }}
      >
        {t(`getStarted.onboarding.tracker.badges.${status}`)}
      </span>
      {isNext && <img src={icon} alt="" className="w-[15px] h-[15px]" />}
    </div>
  );
}

export default function GetStartedOnboarding() {
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

  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [services, setServices] = useState("");
  const [hadWebsite, setHadWebsite] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const s = location.state?.submission;
    if (!s) return;
    if (s.businessName) setBusinessName(s.businessName);
    if (s.businessDescription) setBusinessDescription(s.businessDescription);
    if (s.services) setServices(s.services);
    if (s.hadWebsiteBefore) setHadWebsite(s.hadWebsiteBefore);
    if (s.previousWebsitePlatform) setPlatform(s.previousWebsitePlatform);
  }, [location.state]);

  useEffect(() => {
    if (isMock) return;
    if (!sessionId) return;

    try {
      const raw = localStorage.getItem("hayc_gs_pre_checkout");
      if (!raw) return;

      const preCheckout = JSON.parse(raw);

      const payload: Record<string, unknown> = {};

      if (preCheckout.businessType) {
        const BUSINESS_TYPE_MAP: Record<string, string> = {
          "Local Business": "local_business",
          "Service Business": "service_business",
          "Personal Brand": "personal_brand",
          "Creative Business": "creative_business",
          "Online Store": "online_store",
          "Hospitality/Travel": "hospitality_travel",
          "Health/Wellness": "health_wellness",
          "Other": "other",
        };
        payload.businessType = BUSINESS_TYPE_MAP[preCheckout.businessType] ?? preCheckout.businessType;
      }

      if (preCheckout.businessTypeOtherDetails) {
        payload.websiteGoalOther = preCheckout.businessTypeOtherDetails;
      }

      if (preCheckout.goals && Array.isArray(preCheckout.goals)) {
        const GOAL_MAP: Record<string, string> = {
          "Get more enquiries": "get_enquiries",
          "Book more appointments": "book_appointments",
          "Sell products online": "sell_products",
          "Showcase my work": "showcase_work",
          "Build trust in my business": "build_trust",
          "Share information clearly": "share_information",
          "Something else": "something_else",
        };
        payload.websiteGoals = preCheckout.goals.map(
          (g: string) => GOAL_MAP[g] ?? g,
        );
      }

      if (preCheckout.goalOtherDetails) {
        payload.websiteGoalOther = preCheckout.goalOtherDetails;
      }

      if (preCheckout.suggestedStructure) {
        payload.suggestedStructure = preCheckout.suggestedStructure;
      }
      if (preCheckout.suggestedAddons) {
        payload.suggestedAddons = preCheckout.suggestedAddons;
      }
      if (preCheckout.selectedAddons && Array.isArray(preCheckout.selectedAddons)) {
        payload.selectedAddons = preCheckout.selectedAddons;
      }

      if (preCheckout.selectedDesign) {
        payload.designDirection = preCheckout.selectedDesign;
      }

      if (Object.keys(payload).length === 0) return;

      fetch(`/api/get-started/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) throw new Error("PATCH failed");
          localStorage.removeItem("hayc_gs_pre_checkout");
        })
        .catch((err) => {
          console.warn("Failed to flush pre-checkout data:", err);
        });
    } catch (e) {
      console.warn("Failed to parse pre-checkout data:", e);
    }
  }, []);

  if (!isMock && !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white font-brand">{t("getStarted.onboarding.loading")}</p>
      </div>
    );
  }

  const showPlatform =
    hadWebsite === "yes_worked_well" || hadWebsite === "yes_no_results";

  const row1Status: BadgeStatus = (() => {
    if (businessName.trim() && businessDescription.trim()) return "completed";
    if (businessName.trim() || businessDescription.trim()) return "in_progress";
    return "in_progress";
  })();

  const row2Status: BadgeStatus = (() => {
    if (services.trim()) return "completed";
    return "waiting";
  })();

  const row3Status: BadgeStatus = (() => {
    if (!hadWebsite) return "optional";
    if (hadWebsite === "no_first_time") return "completed";
    if (showPlatform && !platform) return "in_progress";
    if (showPlatform && platform) return "completed";
    return "in_progress";
  })();

  const row4Status: BadgeStatus = "next";

  const [missingFields, setMissingFields] = useState<string[]>([]);

  const getMissingFieldLabels = (): string[] => {
    const missing: string[] = [];
    if (!businessName.trim()) missing.push(t("getStarted.onboarding.labels.businessName"));
    if (!businessDescription.trim()) missing.push(t("getStarted.onboarding.labels.shortDescription"));
    if (!services.trim()) missing.push(t("getStarted.onboarding.labels.addServices"));
    if (!hadWebsite) missing.push(t("getStarted.onboarding.labels.hadWebsite"));
    if (showPlatform && !platform) missing.push(t("getStarted.onboarding.labels.whereBuilt"));
    return missing;
  };

  const handleContinue = async () => {
    const missing = getMissingFieldLabels();
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    if (isMock) {
      navigate(`/get-started/onboarding/quick-questions?mock=true`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/get-started/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessDescription: businessDescription.trim(),
          services: services.trim(),
          hadWebsiteBefore: hadWebsite,
          previousWebsitePlatform: showPlatform ? platform : null,
          currentStep: 7,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      navigate(`/get-started/onboarding/quick-questions?s=${sessionId}`);
    } catch (err) {
      console.error(err);
      toast({ title: t("getStarted.onboarding.errors.saveFailed"), variant: "destructive" });
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
        businessName: businessName.trim() || null,
        businessDescription: businessDescription.trim() || null,
        services: services.trim() || null,
        hadWebsiteBefore: hadWebsite || null,
        previousWebsitePlatform: showPlatform ? platform : null,
        currentStep: 6,
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
            {t("getStarted.onboarding.title")}
          </h1>
          <p className="text-white text-lg font-medium font-brand">
            {t("getStarted.onboarding.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1">
            <label className="text-[#eff6ff] text-base leading-[160%] font-brand">
              {t("getStarted.onboarding.labels.businessName")}
            </label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t("getStarted.onboarding.placeholders.businessName")}
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-brand placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[#eff6ff] text-base leading-[160%] font-brand">
              {t("getStarted.onboarding.labels.shortDescription")}
            </label>
            <input
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder={t("getStarted.onboarding.placeholders.shortDescription")}
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-brand placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[#eff6ff] text-base leading-[160%] font-brand">
              {t("getStarted.onboarding.labels.addServices")}
            </label>
            <input
              value={services}
              onChange={(e) => setServices(e.target.value)}
              placeholder={t("getStarted.onboarding.placeholders.services")}
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-brand placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-[#eff6ff] text-base leading-[160%] font-brand">
              {t("getStarted.onboarding.labels.hadWebsite")}
            </label>
            <div className="flex flex-col gap-2">
              {HAD_WEBSITE_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setHadWebsite(value);
                    if (value === "no_first_time") setPlatform(null);
                  }}
                  className={cn(
                    "w-fit px-3 py-1.5 rounded-[10px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
                    hadWebsite === value
                      ? "bg-[#ED4C14] border-[#ED4C14]"
                      : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                  )}
                >
                  {t(`getStarted.onboarding.hadWebsiteOptions.${value}`)}
                </button>
              ))}
            </div>

            {showPlatform && (
              <div className="rounded-[15px] bg-[#141414] border border-[#2a2a2a] p-[15px] flex flex-col gap-3">
                <label className="text-[#eff6ff] text-base leading-[160%] font-brand">
                  {t("getStarted.onboarding.labels.whereBuilt")}
                </label>
                <div className="flex flex-wrap gap-3">
                  {PLATFORM_VALUES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPlatform(value)}
                      className={cn(
                        "px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
                        platform === value
                          ? "bg-[#ED4C14] border-[#ED4C14]"
                          : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                      )}
                    >
                      {t(`getStarted.onboarding.platformOptions.${value}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSubmitting}
            className="w-full md:w-1/3 h-11 px-5 bg-[#ED4C14] rounded-[10px] flex items-center justify-center text-white text-base font-semibold font-brand leading-5 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("getStarted.onboarding.buttons.saving") : t("getStarted.onboarding.buttons.continue")}
          </button>
          <button
            type="button"
            onClick={handleSaveLater}
            className="w-full md:w-auto h-11 px-5 rounded-[10px] flex items-center justify-center border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
          >
            <span className="text-white text-base font-semibold font-brand leading-5">
              {t("getStarted.onboarding.buttons.completeLater")}
            </span>
          </button>
        </div>
      </div>

      <Dialog open={missingFields.length > 0} onOpenChange={(open) => { if (!open) setMissingFields([]); }}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white max-w-sm">
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
              {t("getStarted.onboarding.tracker.eyebrow")}
            </span>
            <div className="flex flex-col gap-3">
              <h2 className="text-black text-2xl font-medium font-brand">
                {t("getStarted.onboarding.tracker.title")}
              </h2>
              <p className="text-black text-base leading-[160%] font-brand">
                {t("getStarted.onboarding.tracker.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { ...TRACKER_ITEMS[0], status: row1Status },
              { ...TRACKER_ITEMS[1], status: row2Status },
              { ...TRACKER_ITEMS[2], status: row3Status },
              { ...TRACKER_ITEMS[3], status: row4Status },
            ].map((item) => (
              <div
                key={item.number}
                className="flex items-center justify-between px-[15px] py-[30px] rounded-[10px] border-2 border-[#f6efe8]"
              >
                <div className="flex items-center gap-6">
                  <div className="w-[37px] h-[41px] rounded-lg bg-[#f6efe8] flex items-center justify-center flex-shrink-0">
                    <span className="text-black text-2xl font-medium font-brand">
                      {item.number}
                    </span>
                  </div>
                  <img
                    src={item.icon}
                    alt={t(`getStarted.onboarding.tracker.items.${item.key}.title`)}
                    className="w-[37px] h-[37px] flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-black text-sm font-semibold font-brand">
                      {t(`getStarted.onboarding.tracker.items.${item.key}.title`)}
                    </span>
                    <span className="text-black text-sm font-normal leading-[22px] font-brand">
                      {t(`getStarted.onboarding.tracker.items.${item.key}.subtitle`)}
                    </span>
                  </div>
                </div>
                <TrackerBadge status={item.status} />
              </div>
            ))}
          </div>

          <div className="w-full h-px bg-[#f6efe8]" />

          <div className="flex items-center gap-[18px] px-5">
            <img
              src="https://res.cloudinary.com/dem12vqtl/image/upload/v1779286575/Check_wfg5zk.svg"
              alt="check"
              className="w-5 h-5 flex-shrink-0"
            />
            <p className="text-black text-sm leading-[22px] font-brand">
              {t("getStarted.onboarding.tracker.footer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

