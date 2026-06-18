import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type LandingNewsletterOptInFieldProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function LandingNewsletterOptInField({ checked, onChange }: LandingNewsletterOptInFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5",
          checked ? "bg-[#ED4C14] border-[#ED4C14]" : "bg-transparent border-neutral-500",
        )}
        aria-checked={checked}
        role="checkbox"
      >
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>
      <span className="text-white/70 text-xs font-normal font-brand leading-5">
        {t("landingPage.form.newsletterOptIn")}
      </span>
    </div>
  );
}
