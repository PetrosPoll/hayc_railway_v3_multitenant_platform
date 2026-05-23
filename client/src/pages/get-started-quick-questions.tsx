import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SELF_DESCRIPTION_OPTIONS = [
  { value: "know_exactly", label: "I know exactly what I want" },
  { value: "rough_idea", label: "I have a rough idea" },
  { value: "need_guidance", label: "I need guidance, I'm not sure yet" },
] as const;

const CONCERN_OPTIONS = [
  { value: "getting_done_fast", label: "Getting it done fast" },
  { value: "making_it_look_right", label: "Making it look right" },
  { value: "technical_side", label: "The technical side" },
  { value: "bringing_clients", label: "Knowing it will actually bring me clients" },
  { value: "the_cost", label: "The cost" },
] as const;

const HEARD_ABOUT_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "google", label: "Google" },
  { value: "referral", label: "Referral from someone" },
  { value: "other", label: "Other" },
] as const;

export default function GetStartedQuickQuestions() {
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
        <p className="text-white font-['Montserrat']">Loading...</p>
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

  const handleNext = async () => {
    if (!selfDescription) {
      toast({ title: "Please describe yourself going into this", variant: "destructive" });
      return;
    }
    if (concerns.length === 0) {
      toast({ title: "Please select at least one concern", variant: "destructive" });
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
    <div className="min-h-screen bg-black flex">
      <div className="flex-1 flex flex-col justify-between px-[70px] py-[50px] gap-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-white text-4xl font-semibold font-['Montserrat']">
            Just a few quick questions
          </h1>
          <p className="text-white text-base leading-[160%] font-['Montserrat']">
            Helps us personalise your experience. Takes 30 seconds.
          </p>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
              How would you describe yourself going into this?
            </p>
            <div className="flex flex-wrap gap-2">
              {SELF_DESCRIPTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelfDescription(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer",
                    selfDescription === opt.value
                      ? "bg-[#ED4C14] border-[#ED4C14]"
                      : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] py-6">
            <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
              What's your biggest concern about this process?
            </p>
            <div className="flex flex-wrap gap-2">
              {CONCERN_OPTIONS.map((opt) => {
                const isSelected = concerns.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleMulti(opt.value, concerns, setConcerns)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer",
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
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 py-6">
            <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
              How did you hear about us?
            </p>
            <div className="flex flex-wrap gap-2">
              {HEARD_ABOUT_OPTIONS.map((opt) => {
                const isSelected = heardAbout.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleMulti(opt.value, heardAbout, setHeardAbout)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-['Montserrat'] border transition-colors cursor-pointer",
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
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="w-1/3 h-11 px-5 bg-[#ED4C14] rounded-[10px] flex items-center justify-center text-white text-base font-semibold font-['Montserrat'] leading-5 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Next"}
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
                Your guided setup
              </h2>
              <p className="text-black text-base leading-[160%] font-['Montserrat']">
                Your answers help us shape the next steps around you
              </p>
            </div>
          </div>

          <div className="flex flex-col px-[41px] gap-0">
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="rounded-full border border-[#e0dbd4] p-1">
                  <div className="h-[27px] w-[27px] rounded-full bg-[#ED4C14] flex items-center justify-center">
                    <span className="text-[#eff6ff] text-sm font-medium font-['Montserrat']">1</span>
                  </div>
                </div>
                <div className="w-px flex-1 min-h-[40px] bg-[#e0dbd4]" />
              </div>
              <div className="flex flex-col gap-1 pb-8 pt-1">
                <span className="text-black text-sm font-semibold tracking-[0.02em] font-['Montserrat']">
                  Understand your direction
                </span>
                <span className="text-black text-sm leading-[22px] font-['Montserrat']">
                  We learn how clear your vision is.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="rounded-full border border-[#e0dbd4] p-1">
                  <div className="h-[27px] w-[27px] rounded-full bg-[#ED4C14] flex items-center justify-center">
                    <span className="text-[#eff6ff] text-sm font-medium font-['Montserrat']">2</span>
                  </div>
                </div>
                <div className="w-px flex-1 min-h-[40px] bg-[#e0dbd4]" />
              </div>
              <div className="flex flex-col gap-1 pb-8 pt-1">
                <span className="text-black text-sm font-semibold tracking-[0.02em] font-['Montserrat']">
                  Spot your main priority
                </span>
                <span className="text-black text-sm leading-[22px] font-['Montserrat']">
                  We focus on what matters most.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="rounded-full border border-[#e0dbd4] p-1">
                  <div className="h-[27px] w-[27px] rounded-full bg-[#ED4C14] flex items-center justify-center">
                    <span className="text-[#eff6ff] text-sm font-medium font-['Montserrat']">3</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-black text-sm font-semibold tracking-[0.02em] font-['Montserrat']">
                  Shape the next steps
                </span>
                <span className="text-black text-sm leading-[22px] font-['Montserrat']">
                  We tailor the process around your answers.
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
            <p className="text-black text-sm leading-[22px] font-['Montserrat']">
              This helps us guide your setup without slowing you down
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
