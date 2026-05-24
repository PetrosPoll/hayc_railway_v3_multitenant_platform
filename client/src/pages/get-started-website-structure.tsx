import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Image, ShoppingBag, Tag, HelpCircle, MessageSquare,
  BookOpen, Users, MapPin, Briefcase, Newspaper,
  CalendarDays, GraduationCap, Handshake, Star, AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ALL_PAGES = [
  "Home", "About", "Services", "Contact", "Booking",
  "Gallery", "Products", "Pricing", "FAQ", "Testimonials",
  "Blog", "Team", "Location", "Portfolio", "Press",
  "Events", "Careers", "Partners", "Reviews",
];

const CLOUDINARY_BASE = "https://res.cloudinary.com/dem12vqtl/image/upload";

const PAGE_IMG_ICONS: Record<string, string> = {
  Home: `${CLOUDINARY_BASE}/home_orange_kalaqd.svg`,
  About: `${CLOUDINARY_BASE}/user_orange_otyn6n.svg`,
  Services: `${CLOUDINARY_BASE}/star_emtpy_orange_zuudng.svg`,
  Contact: `${CLOUDINARY_BASE}/mail_orange_vj8ss7.svg`,
  Booking: `${CLOUDINARY_BASE}/calendar_orange_yt37oa.svg`,
};

const PAGE_LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Gallery: Image,
  Products: ShoppingBag,
  Pricing: Tag,
  FAQ: HelpCircle,
  Testimonials: MessageSquare,
  Blog: BookOpen,
  Team: Users,
  Location: MapPin,
  Portfolio: Briefcase,
  Press: Newspaper,
  Events: CalendarDays,
  Careers: GraduationCap,
  Partners: Handshake,
  Reviews: Star,
};

const WEBSITE_ICON = `${CLOUDINARY_BASE}/cmd-icon_vunwc0.svg`;
const PAGES_SELECTED_ICON = `${CLOUDINARY_BASE}/doc_orange_iyyo0u.svg`;

function PageIcon({ page, className }: { page: string; className?: string }) {
  const imgSrc = PAGE_IMG_ICONS[page];
  if (imgSrc) {
    return <img src={imgSrc} alt="" className={className} />;
  }
  const LucideIcon = PAGE_LUCIDE_ICONS[page];
  if (LucideIcon) {
    return <LucideIcon className={cn("text-[#ED4C14]", className)} strokeWidth={1.25} />;
  }
  return <img src={`${CLOUDINARY_BASE}/doc_orange_iyyo0u.svg`} alt="" className={className} />;
}

const DOC_ICON_CLASS = "w-[38px] h-[38px]";

const PLAN_PAGE_LIMITS: Record<string, number> = {
  basic: 3,
  essential: 10,
  pro: 50,
};

function getPlanPageLimit(plan: string | null): number {
  if (!plan) return 10;
  return PLAN_PAGE_LIMITS[plan] ?? 10;
}

export default function GetStartedWebsiteStructure() {
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

  const [recommendedPages, setRecommendedPages] = useState<string[]>([
    "Home", "About", "Services", "Contact", "Booking",
  ]);
  const [customPageInput, setCustomPageInput] = useState("");
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
  const [selectedPages, setSelectedPages] = useState<string[]>([
    "Home", "About", "Services", "Contact", "Booking",
  ]);
  const [pagesNotes, setPagesNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const PAGES_PER_PAGE = isMobile ? 3 : 4;

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      setCurrentPage(1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const s = location.state?.submission;
    if (!s) return;
    if (s.confirmedPages && Array.isArray(s.confirmedPages)) {
      setSelectedPages(s.confirmedPages);
    }
    if (s.pagesNotes) setPagesNotes(s.pagesNotes);
  }, [location.state]);

  const pageLimit = getPlanPageLimit(userPlan);
  const isAtLimit = selectedPages.length >= pageLimit;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPages.length]);

  useEffect(() => {
    if (isMock) {
      try {
        const preCheckout = localStorage.getItem("hayc_gs_pre_checkout");
        if (preCheckout) {
          const parsed = JSON.parse(preCheckout);
          if (parsed.plan) {
            setUserPlan(parsed.plan);
            const limit = PLAN_PAGE_LIMITS[parsed.plan] ?? 10;
            const fallback = ["Home", "About", "Services", "Contact", "Booking"];
            const trimmed = fallback.slice(0, limit);
            setRecommendedPages(trimmed);
            setSelectedPages(trimmed);
          }
        }
      } catch (e) {
        console.warn("Failed to read plan in mock mode");
      }
      setIsLoadingStructure(false);
      return;
    }
    if (!sessionId) {
      setIsLoadingStructure(false);
      return;
    }

    let planLimit = 10;
    try {
      const preCheckout = localStorage.getItem("hayc_gs_pre_checkout");
      if (preCheckout) {
        const parsed = JSON.parse(preCheckout);
        if (parsed.plan) {
          setUserPlan(parsed.plan);
          planLimit = PLAN_PAGE_LIMITS[parsed.plan] ?? 10;
        }
      }
    } catch (e) {
      console.warn("Failed to read plan from localStorage");
    }

    fetch(`/api/get-started/${sessionId}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const structure = data?.submission?.suggestedStructure;
        const confirmed = data?.submission?.confirmedPages;

        const plan = data?.submission?.selectedPlan;
        if (plan) {
          setUserPlan(plan);
          planLimit = PLAN_PAGE_LIMITS[plan] ?? 10;
        }

        if (Array.isArray(structure) && structure.length > 0) {
          const trimmed = structure.slice(0, planLimit);
          setRecommendedPages(trimmed);

          if (Array.isArray(confirmed) && confirmed.length > 0) {
            setSelectedPages(confirmed);
          } else {
            setSelectedPages(trimmed);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to load suggested structure:", err);
      })
      .finally(() => {
        setIsLoadingStructure(false);
      });
  }, [sessionId]);

  if (!isMock && !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white font-brand">{t("getStarted.websiteStructure.loading")}</p>
      </div>
    );
  }

  const planDisplayName = userPlan
    ? userPlan.charAt(0).toUpperCase() + userPlan.slice(1)
    : t("getStarted.websiteStructure.pageLimit.current");

  const getPageLabel = (page: string): string => {
    if (!ALL_PAGES.includes(page)) return page;
    return t(`getStarted.websiteStructure.pages.${page}`);
  };

  const togglePage = (page: string) => {
    const isCurrentlySelected = selectedPages.includes(page);
    if (!isCurrentlySelected && isAtLimit) {
      toast({
        title: t("getStarted.websiteStructure.errors.pageLimitReached"),
        description: t("getStarted.websiteStructure.errors.pageLimitDesc", {
          plan: planDisplayName,
          limit: pageLimit,
        }),
        variant: "destructive",
      });
      return;
    }
    setSelectedPages((current) =>
      current.includes(page)
        ? current.filter((p) => p !== page)
        : [...current, page],
    );
  };

  const addCustomPage = () => {
    const trimmed = customPageInput.trim();
    if (!trimmed) return;
    const trimmedLower = trimmed.toLowerCase();
    if (selectedPages.some((p) => p.toLowerCase() === trimmedLower)) {
      toast({ title: t("getStarted.websiteStructure.errors.pageAlreadySelected"), variant: "destructive" });
      return;
    }
    if (ALL_PAGES.some((p) => p.toLowerCase() === trimmedLower)) {
      toast({ title: t("getStarted.websiteStructure.errors.pageAvailableAbove"), variant: "destructive" });
      return;
    }
    if (isAtLimit) {
      toast({
        title: t("getStarted.websiteStructure.errors.pageLimitReached"),
        description: t("getStarted.websiteStructure.errors.pageLimitDesc", {
          plan: planDisplayName,
          limit: pageLimit,
        }),
        variant: "destructive",
      });
      return;
    }
    setSelectedPages((current) => [...current, trimmed]);
    setCustomPageInput("");
  };

  const confirmedPages = selectedPages;
  const totalPages = confirmedPages.length;

  const [missingFields, setMissingFields] = useState<string[]>([]);

  const getMissingFieldLabels = (): string[] => {
    const missing: string[] = [];
    if (selectedPages.length === 0) missing.push(t("getStarted.websiteStructure.errors.selectAtLeastOne"));
    return missing;
  };

  const handleContinue = async () => {
    const missing = getMissingFieldLabels();
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    if (isMock) {
      navigate(`/get-started/onboarding/content-media?mock=true`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/get-started/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          confirmedPages,
          pagesNotes: pagesNotes.trim() || null,
          currentStep: 9,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      navigate(`/get-started/onboarding/content-media?s=${sessionId}`);
    } catch (err) {
      console.error(err);
      toast({ title: t("getStarted.websiteStructure.errors.saveFailed"), variant: "destructive" });
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
        confirmedPages: selectedPages,
        pagesNotes: pagesNotes.trim() || null,
        currentStep: 8,
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
      <div className="flex-1 flex flex-col px-4 md:px-[70px] py-8 md:py-[50px] gap-6 md:gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-white text-2xl md:text-4xl font-semibold font-brand">
            {t("getStarted.websiteStructure.title")}
          </h1>
          <p className="text-white text-base leading-[160%] font-brand">
            {t("getStarted.websiteStructure.subtitle")}
          </p>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-brand">
                {t("getStarted.websiteStructure.sections.recommendedPages.title")}
              </p>
              <p className="text-[#eff6ff] text-base leading-[160%] font-brand">
                {t("getStarted.websiteStructure.sections.recommendedPages.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-medium font-brand",
                isAtLimit ? "text-[#ED4C14]" : "text-white/50"
              )}>
                {isAtLimit
                  ? t("getStarted.websiteStructure.pageLimit.reached", { plan: planDisplayName })
                  : t("getStarted.websiteStructure.pageLimit.counter", {
                      selected: selectedPages.length,
                      limit: pageLimit,
                    })}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {recommendedPages.map((page) => {
                const isSelected = selectedPages.includes(page);
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => togglePage(page)}
                    className={cn(
                      "flex items-center gap-2 px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
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
                    {getPageLabel(page)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-brand">
                {t("getStarted.websiteStructure.sections.addMorePages.title")}
              </p>
              <p className="text-[#eff6ff] text-base leading-[160%] font-brand">
                {t("getStarted.websiteStructure.sections.addMorePages.subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {ALL_PAGES.filter((page) => !recommendedPages.includes(page)).map((page) => {
                const isSelected = selectedPages.includes(page);
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => togglePage(page)}
                    className={cn(
                      "flex items-center gap-2 px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#ED4C14] border-[#ED4C14]"
                        : isAtLimit
                          ? "bg-transparent border-[#3a3a3a] text-white/30 cursor-not-allowed"
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
                    {getPageLabel(page)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-brand">
                {t("getStarted.websiteStructure.sections.addCustomPage.title")}
              </p>
              <p className="text-[#eff6ff] text-base leading-[160%] font-brand">
                {t("getStarted.websiteStructure.sections.addCustomPage.subtitle")}
              </p>
            </div>
            <div className="flex gap-3">
              <input
                value={customPageInput}
                onChange={(e) => setCustomPageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPage(); } }}
                placeholder={t("getStarted.websiteStructure.sections.addCustomPage.placeholder")}
                className="flex-1 px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-brand placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
              />
              <button
                type="button"
                onClick={addCustomPage}
                disabled={!customPageInput.trim() || isAtLimit}
                className="h-11 px-5 bg-[#ED4C14] rounded-[10px] text-white text-sm font-semibold font-brand border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {t("getStarted.websiteStructure.sections.addCustomPage.addButton")}
              </button>
            </div>
            {selectedPages.filter(p => !ALL_PAGES.includes(p)).length > 0 && (
              <div className="flex flex-wrap gap-3">
                {selectedPages
                  .filter(p => !ALL_PAGES.includes(p))
                  .map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => togglePage(page)}
                      className="flex items-center gap-2 px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer bg-[#ED4C14] border-[#ED4C14]"
                    >
                      <div className="w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center bg-white border-white">
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path
                            d="M1 3.5L3 5.5L7 1"
                            stroke="#ED4C14"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      {page}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 py-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-brand">
                {t("getStarted.websiteStructure.sections.notes.title")}
              </p>
            </div>
            <input
              value={pagesNotes}
              onChange={(e) => setPagesNotes(e.target.value)}
              placeholder={t("getStarted.websiteStructure.sections.notes.placeholder")}
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-brand placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
            <p className="text-[#f2f6fa] text-base leading-[160%] font-brand">
              {t("getStarted.websiteStructure.sections.notes.helper")}
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full md:w-1/3 h-11 px-5 bg-[#ED4C14] rounded-[10px] flex items-center justify-center text-white text-base font-semibold font-brand leading-5 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t("getStarted.websiteStructure.buttons.saving") : t("getStarted.websiteStructure.buttons.continue")}
            </button>
            <button
              type="button"
              onClick={handleSaveLater}
              className="w-full md:w-auto h-11 px-5 rounded-[10px] flex items-center justify-center border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
            >
              <span className="text-white text-base font-semibold font-brand leading-5">
                {t("getStarted.websiteStructure.buttons.completeLater")}
              </span>
            </button>
          </div>
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

      <div className="flex w-full md:w-[661px] md:min-h-screen bg-[#fcf6ee] flex-col items-center justify-center px-4 md:px-[46px] py-8 md:py-[10px] gap-8 md:gap-12">
        <div className="w-full px-5 flex flex-col gap-3">
          <h2 className="text-black text-2xl font-medium font-brand">
            {t("getStarted.websiteStructure.panel.title")}
          </h2>
          <p className="text-black text-base leading-[160%] font-brand">
            {t("getStarted.websiteStructure.panel.subtitle")}
          </p>
        </div>

        <div className="w-full md:w-[565px] rounded-[20px] bg-[#fefaf7] border border-[#f6efe8] shadow-[0_0_12px_#e0dbd4] p-4 md:p-[25px] flex flex-col items-center gap-0 overflow-hidden">
          <div className="w-[223px] h-[90px] rounded-[10px] bg-[#fefaf7] border border-[#f6efe8] shadow-[0_3px_8px_#e0dbd4] flex items-center justify-center gap-6 flex-shrink-0">
            <img src={WEBSITE_ICON} alt="" className="w-[26px] h-[26px]" />
            <span className="text-black text-base font-semibold font-brand">
              {t("getStarted.websiteStructure.panel.websiteLabel")}
            </span>
          </div>

          {(() => {
            const childPages = selectedPages;
            const totalChildPages = childPages.length;
            const totalPaginationPages = Math.ceil(totalChildPages / PAGES_PER_PAGE);
            const visibleChildren = childPages.slice(
              (currentPage - 1) * PAGES_PER_PAGE,
              currentPage * PAGES_PER_PAGE,
            );
            const hasChildren = childPages.length > 0;

            if (!hasChildren) return null;

            return (
              <>
                <div className="w-px h-8 bg-[#e0dbd4]" />

                <div className="relative w-full flex items-start justify-center">
                  {visibleChildren.length > 1 && (
                    <div
                      className="absolute top-0 bg-[#e0dbd4]"
                      style={{
                        height: "1px",
                        left: `calc(50% - ${((visibleChildren.length - 1) * 137) / 2}px)`,
                        width: `${(visibleChildren.length - 1) * 137}px`,
                      }}
                    />
                  )}

                  <div className="flex items-start gap-6">
                    {visibleChildren.map((page) => (
                      <div key={page} className="flex flex-col items-center gap-0">
                        <div className="w-px h-8 bg-[#e0dbd4]" />
                        <div className="h-[120px] w-[113px] rounded-[10px] bg-[#fefaf7] border border-[#f6efe8] shadow-[0_3px_8px_#e0dbd4] flex flex-col items-center px-2 pt-5 pb-4">
                          <div className="h-[38px] w-[38px] flex items-center justify-center flex-shrink-0">
                            <PageIcon page={page} className="max-h-[38px] max-w-[38px] w-[28px] h-[28px] object-contain" />
                          </div>
                          <span className="mt-auto text-center text-black text-sm font-semibold font-brand leading-tight">
                            {getPageLabel(page)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {totalPaginationPages > 1 && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium font-brand border border-[#e0dbd4] bg-transparent text-black disabled:opacity-30 cursor-pointer hover:border-[#ED4C14] transition-colors"
                    >
                      ‹
                    </button>

                    {Array.from({ length: totalPaginationPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium font-brand border transition-colors cursor-pointer",
                          currentPage === page
                            ? "bg-[#ED4C14] border-[#ED4C14] text-white"
                            : "bg-transparent border-[#e0dbd4] text-black hover:border-[#ED4C14]",
                        )}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPaginationPages, p + 1))}
                      disabled={currentPage === totalPaginationPages}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium font-brand border border-[#e0dbd4] bg-transparent text-black disabled:opacity-30 cursor-pointer hover:border-[#ED4C14] transition-colors"
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="w-full px-5 flex items-center gap-6">
          <div className="w-[60px] h-[60px] rounded-full bg-[#f6efe8] flex-shrink-0 flex items-center justify-center">
            <img
              src={PAGES_SELECTED_ICON}
              alt=""
              className={DOC_ICON_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-black text-lg font-medium font-brand">
              {t("getStarted.websiteStructure.panel.pagesSelected", { count: totalPages })}
            </span>
            <span className="text-black text-sm leading-[22px] font-brand">
              {t("getStarted.websiteStructure.panel.pagesSelectedHelper")}
            </span>
          </div>
        </div>
      </div>
      {isLoadingStructure && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black pointer-events-none">
          <svg
            width="52"
            height="52"
            viewBox="0 0 24.24 23.468"
            fill="none"
            style={{ animation: "pulse 1.5s ease-in-out infinite" }}
          >
            <path
              d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
              fill="#ED4C14"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

