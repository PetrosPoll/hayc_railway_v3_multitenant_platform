import { Check } from "lucide-react";
import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField, FormItem } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type LandingLeadFormValues = {
  email: string;
  phone: string;
  newsletterOptIn?: boolean;
};

type LandingNewsletterOptInFieldProps = {
  control: Control<LandingLeadFormValues>;
};

export function LandingNewsletterOptInField({ control }: LandingNewsletterOptInFieldProps) {
  const { t } = useTranslation();

  return (
    <FormField
      control={control}
      name="newsletterOptIn"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => field.onChange(!field.value)}
              className={cn(
                "w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5",
                field.value ? "bg-[#ED4C14] border-[#ED4C14]" : "bg-transparent border-neutral-500",
              )}
              aria-checked={!!field.value}
              role="checkbox"
            >
              {field.value && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </button>
            <span className="text-white/70 text-xs font-normal font-brand leading-5">
              {t("landingPage.form.newsletterOptIn")}
            </span>
          </div>
        </FormItem>
      )}
    />
  );
}
