import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const HAD_WEBSITE_OPTIONS = [
  { value: "yes_worked_well", label: "Yes and it worked well" },
  { value: "yes_no_results", label: "Yes, but it didn't bring results" },
  { value: "no_first_time", label: "No, this is my first one" },
] as const;

const PLATFORM_OPTIONS = [
  { value: "wix", label: "Wix" },
  { value: "squarespace", label: "Squarespace" },
  { value: "wordpress", label: "WordPress" },
  { value: "webflow", label: "Webflow" },
  { value: "someone_built_it", label: "Someone built it for me" },
  { value: "other", label: "Other" },
] as const;

const TRACKER_ITEMS = [
  {
    number: 1,
    title: "Business details",
    subtitle: "Name and short description",
    icon: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286699/building_lyqioo.svg",
  },
  {
    number: 2,
    title: "Services",
    subtitle: "What your business offers",
    icon: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286706/briefcase_ljddhi.svg",
  },
  {
    number: 3,
    title: "Previous website",
    subtitle: "What worked, what didn't, where it was built",
    icon: "https://res.cloudinary.com/dem12vqtl/image/upload/v1779286700/cmd-icon_vunwc0.svg",
  },
  {
    number: 4,
    title: "Next step",
    subtitle: "We review your answers and create the first draft",
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

const BADGE_CONFIG: Record<BadgeStatus, { label: string; bg: string; textColor: string }> = {
  in_progress: { label: "In progress", bg: "#fef0e3", textColor: "#ED4C14" },
  waiting: { label: "Waiting for input", bg: "#f4efea", textColor: "#000000" },
  optional: { label: "Optional", bg: "#f4efea", textColor: "#000000" },
  completed: { label: "Completed", bg: "#ED4C14", textColor: "#ffffff" },
  next: { label: "Next", bg: "#fef0e3", textColor: "#ED4C14" },
};

function TrackerBadge({ status }: { status: BadgeStatus }) {
  const { label, bg, textColor } = BADGE_CONFIG[status];
  const icon = BADGE_ICONS[status];
  const isNext = status === "next";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: bg }}
    >
      {!isNext && <img src={icon} alt="" className="w-[15px] h-[15px]" />}
      <span
        className="text-xs font-medium font-['Montserrat'] leading-[22px] whitespace-nowrap"
        style={{ color: textColor }}
      >
        {label}
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
        <p className="text-white font-['Montserrat']">Loading...</p>
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

  const handleContinue = async () => {
    if (!businessName.trim()) {
      toast({ title: "Please enter your business name", variant: "destructive" });
      return;
    }
    if (!businessDescription.trim()) {
      toast({ title: "Please enter a short description of your business", variant: "destructive" });
      return;
    }
    if (!services.trim()) {
      toast({ title: "Please add your services", variant: "destructive" });
      return;
    }
    if (!hadWebsite) {
      toast({ title: "Please select your website history", variant: "destructive" });
      return;
    }
    if (showPlatform && !platform) {
      toast({ title: "Please select where your previous website was built", variant: "destructive" });
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
      toast({ title: "Failed to save. Please try again.", variant: "destructive" });
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
    <div className="min-h-screen bg-black flex">
      <div className="flex-1 flex flex-col justify-between px-[70px] py-[50px] gap-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-white text-4xl font-semibold font-['Montserrat']">
            Add your services
          </h1>
          <p className="text-white text-lg font-medium font-['Montserrat']">
            Tell us what your business offers.
          </p>
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1">
            <label className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
              Business name
            </label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business name"
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-['Montserrat'] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
              Short Description
            </label>
            <input
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="Write a short description of your business"
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-['Montserrat'] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
              Add your Services
            </label>
            <input
              value={services}
              onChange={(e) => setServices(e.target.value)}
              placeholder="Services"
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-['Montserrat'] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
              Have you had a website before?
            </label>
            <div className="flex flex-col gap-2">
              {HAD_WEBSITE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setHadWebsite(opt.value);
                    if (opt.value === "no_first_time") setPlatform(null);
                  }}
                  className={cn(
                    "w-fit px-3 py-1.5 rounded-[10px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer",
                    hadWebsite === opt.value
                      ? "bg-[#ED4C14] border-[#ED4C14]"
                      : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {showPlatform && (
              <div className="rounded-[15px] bg-[#141414] border border-[#2a2a2a] p-[15px] flex flex-col gap-3">
                <label className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
                  Where was it built?
                </label>
                <div className="flex flex-wrap gap-3">
                  {PLATFORM_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPlatform(opt.value)}
                      className={cn(
                        "px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer",
                        platform === opt.value
                          ? "bg-[#ED4C14] border-[#ED4C14]"
                          : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSubmitting}
            className="w-1/3 h-11 px-5 bg-[#ED4C14] rounded-[10px] flex items-center justify-center text-white text-base font-semibold font-['Montserrat'] leading-5 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </button>
          <button
            type="button"
            onClick={handleSaveLater}
            className="h-11 px-5 py-3.5 rounded-[10px] inline-flex justify-start items-center gap-4 border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
          >
            <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">
              Complete later
            </span>
          </button>
        </div>
      </div>

      <div className="w-[661px] min-h-screen bg-[#fcf6ee] flex items-center justify-center p-[10px]">
        <div className="w-[565px] rounded-[20px] bg-[#fefaf7] border border-[#f6efe8] shadow-[0_0_12px_#e0dbd4] p-[25px] flex flex-col gap-12">
          <div className="flex flex-col gap-6 px-5">
            <span className="text-[#ED4C14] text-sm font-semibold tracking-[0.02em] font-['Montserrat'] uppercase">
              Website Setup
            </span>
            <div className="flex flex-col gap-3">
              <h2 className="text-black text-2xl font-medium font-['Montserrat']">
                Your website content blueprint
              </h2>
              <p className="text-black text-base leading-[160%] font-['Montserrat']">
                We'll use these details to shape your first website draft
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
                    <span className="text-black text-2xl font-medium font-['Montserrat']">
                      {item.number}
                    </span>
                  </div>
                  <img
                    src={item.icon}
                    alt={item.title}
                    className="w-[37px] h-[37px] flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-black text-sm font-semibold font-['Montserrat']">
                      {item.title}
                    </span>
                    <span className="text-black text-sm font-normal leading-[22px] font-['Montserrat']">
                      {item.subtitle}
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
            <p className="text-black text-sm leading-[22px] font-['Montserrat']">
              Your final website will be tailored to your brand, content and selected setup
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
