import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ALL_PAGES = [
  "Home", "About", "Services", "Contact", "Booking",
  "Gallery", "Products", "Pricing", "FAQ", "Testimonials",
  "Blog", "Team", "Location", "Portfolio", "Press",
  "Events", "Careers", "Partners", "Reviews",
];

const CLOUDINARY_BASE = "https://res.cloudinary.com/dem12vqtl/image/upload";

const PAGE_ICONS: Record<string, string> = {
  Home: `${CLOUDINARY_BASE}/home_orange_kalaqd.svg`,
  About: `${CLOUDINARY_BASE}/user_orange_otyn6n.svg`,
  Services: `${CLOUDINARY_BASE}/star_emtpy_orange_zuudng.svg`,
  Contact: `${CLOUDINARY_BASE}/mail_orange_vj8ss7.svg`,
  Booking: `${CLOUDINARY_BASE}/calendar_orange_yt37oa.svg`,
};

const WEBSITE_ICON = `${CLOUDINARY_BASE}/cmd-icon_vunwc0.svg`;
const DEFAULT_PAGE_ICON = `${CLOUDINARY_BASE}/doc_orange_iyyo0u.svg`;
const PAGES_SELECTED_ICON = `${CLOUDINARY_BASE}/doc_orange_iyyo0u.svg`;

function getPageIconUrl(page: string): string {
  return PAGE_ICONS[page] ?? DEFAULT_PAGE_ICON;
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
  const PAGES_PER_PAGE = 4;

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

        // selectedPlan from the submission is the authoritative source
        const plan = data?.submission?.selectedPlan;
        if (plan) {
          setUserPlan(plan);
          planLimit = PLAN_PAGE_LIMITS[plan] ?? 10;
        }

        if (Array.isArray(structure) && structure.length > 0) {
          const trimmed = structure.slice(0, planLimit);
          setRecommendedPages(trimmed);

          // Confirmed pages (user's manual selections) take priority over the
          // suggested structure. Only fall back to suggestedStructure if the
          // user has never explicitly confirmed a page selection.
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
        <p className="text-white font-['Montserrat']">Loading...</p>
      </div>
    );
  }

  const togglePage = (page: string) => {
    const isCurrentlySelected = selectedPages.includes(page);
    if (!isCurrentlySelected && isAtLimit) {
      toast({
        title: `Page limit reached`,
        description: `Your ${userPlan ?? "current"} plan allows up to ${pageLimit} pages.`,
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
      toast({ title: "This page is already in your selection.", variant: "destructive" });
      return;
    }
    if (ALL_PAGES.some((p) => p.toLowerCase() === trimmedLower)) {
      toast({ title: "This page is available in the list above — select it from there.", variant: "destructive" });
      return;
    }
    if (isAtLimit) {
      toast({
        title: `Page limit reached`,
        description: `Your ${userPlan ?? "current"} plan allows up to ${pageLimit} pages.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedPages((current) => [...current, trimmed]);
    setCustomPageInput("");
  };

  const confirmedPages = selectedPages;
  const totalPages = confirmedPages.length;

  const handleContinue = async () => {
    if (selectedPages.length === 0) {
      toast({
        title: "Please select at least one page",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-black flex">
      <div className="flex-1 flex flex-col px-[70px] py-[50px] gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-white text-4xl font-semibold font-['Montserrat']">
            Confirm your website structure
          </h1>
          <p className="text-white text-base leading-[160%] font-['Montserrat']">
            We've suggested a starting structure based on your answers. You can adjust it before we begin.
          </p>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
                Recommended pages
              </p>
              <p className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
                These pages are included in your suggested setup.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-medium font-['Montserrat']",
                isAtLimit ? "text-[#ED4C14]" : "text-white/50"
              )}>
                {isAtLimit
                  ? `Limit reached based on ${userPlan ? userPlan.charAt(0).toUpperCase() + userPlan.slice(1) : "current"} plan`
                  : `${selectedPages.length} / ${pageLimit} pages`}
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
                      "flex items-center gap-2 px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer",
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
                    {page}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
                Add more pages
              </p>
              <p className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
                Need more pages? Select any extra pages you'd like us to include or review.
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
                      "flex items-center gap-2 px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer",
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
                    {page}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
                Add a custom page
              </p>
              <p className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
                Don't see the page you need? Type it below and add it.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                value={customPageInput}
                onChange={(e) => setCustomPageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPage(); } }}
                placeholder="e.g. Portfolio, Events, Press..."
                className="flex-1 px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-['Montserrat'] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
              />
              <button
                type="button"
                onClick={addCustomPage}
                disabled={!customPageInput.trim() || isAtLimit}
                className="h-11 px-5 bg-[#ED4C14] rounded-[10px] text-white text-sm font-semibold font-['Montserrat'] border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                Add
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
                      className="flex items-center gap-2 px-[15px] py-2 rounded-[39px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer bg-[#ED4C14] border-[#ED4C14]"
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
              <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
                Anything we should know about these pages? (optional)
              </p>
            </div>
            <input
              value={pagesNotes}
              onChange={(e) => setPagesNotes(e.target.value)}
              placeholder="e.g. I need a separate page for each service."
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-['Montserrat'] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14]"
            />
            <p className="text-[#f2f6fa] text-base leading-[160%] font-['Montserrat']">
              Optional, but helpful if your website needs a specific structure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSubmitting || selectedPages.length === 0}
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
      </div>

      <div className="w-[661px] min-h-screen bg-[#fcf6ee] flex flex-col items-center justify-center px-[46px] py-[10px] gap-12">
        <div className="w-full px-5 flex flex-col gap-3">
          <h2 className="text-black text-2xl font-medium font-['Montserrat']">
            Your website map
          </h2>
          <p className="text-black text-base leading-[160%] font-['Montserrat']">
            A simple view of the pages we'll prepare for your website.
          </p>
        </div>

        <div className="w-[565px] rounded-[20px] bg-[#fefaf7] border border-[#f6efe8] shadow-[0_0_12px_#e0dbd4] p-[25px] flex flex-col items-center gap-0 overflow-hidden">
          <div className="w-[223px] h-[90px] rounded-[10px] bg-[#fefaf7] border border-[#f6efe8] shadow-[0_3px_8px_#e0dbd4] flex items-center justify-center gap-6 flex-shrink-0">
            <img src={WEBSITE_ICON} alt="" className="w-[26px] h-[26px]" />
            <span className="text-black text-base font-semibold font-['Montserrat']">Website</span>
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
                            <img
                              src={getPageIconUrl(page)}
                              alt=""
                              className="max-h-[38px] max-w-[38px] object-contain"
                            />
                          </div>
                          <span className="mt-auto text-center text-black text-sm font-semibold font-['Montserrat'] leading-tight">
                            {page}
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium font-['Montserrat'] border border-[#e0dbd4] bg-transparent text-black disabled:opacity-30 cursor-pointer hover:border-[#ED4C14] transition-colors"
                    >
                      ‹
                    </button>

                    {Array.from({ length: totalPaginationPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium font-['Montserrat'] border transition-colors cursor-pointer",
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium font-['Montserrat'] border border-[#e0dbd4] bg-transparent text-black disabled:opacity-30 cursor-pointer hover:border-[#ED4C14] transition-colors"
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
            <span className="text-black text-lg font-medium font-['Montserrat']">
              {totalPages} pages selected
            </span>
            <span className="text-black text-sm leading-[22px] font-['Montserrat']">
              You can add or remove pages before we begin.
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
