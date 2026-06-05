export const landingRootClass = "min-h-screen bg-black overflow-x-hidden font-brand";
export const landingHeroSectionClass = "py-10 lg:py-16 bg-black";
export const landingSectionClass = "py-20 bg-black border-t border-zinc-800";
export const landingCardClass =
  "shadow-xl border-0 !bg-black rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 text-white";
export const landingReviewCardClass =
  "shadow-lg h-full border-0 !bg-black rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 text-white";
export const landingPanelClass =
  "bg-black rounded-lg outline outline-1 outline-zinc-800/80";
export const landingFormLabelClass = "text-slate-100 text-base font-normal font-brand leading-6";
export const landingInputClass =
  "w-full pl-10 px-4 py-3 rounded-lg outline outline-1 outline-offset-[-1px] outline-neutral-500 !bg-black text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-[#ED4C14] focus-visible:outline-2 transition-all border-0";
export const landingSubmitButtonClass =
  "w-full bg-[#ED4C14] hover:bg-[#ED4C14]/90 text-[#EFF6FF] font-semibold font-brand";
export const landingSectionTitleClass = "text-3xl font-bold mb-4 text-white font-brand";
export const landingSectionSubtitleClass = "text-xl text-white/70 font-brand";

export function landingLangButtonClass(active: boolean) {
  return active
    ? "px-3 py-1.5 text-sm rounded border transition-colors border-[#ED4C14] bg-[#ED4C14]/10 text-white ring-2 ring-[#ED4C14]"
    : "px-3 py-1.5 text-sm rounded border transition-colors border-white/20 bg-white/5 text-white/80 hover:bg-white/10";
}
