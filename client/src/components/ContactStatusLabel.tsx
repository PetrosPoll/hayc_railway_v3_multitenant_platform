import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ContactStatusValue = "pending" | "active" | "unsubscribed";

const STATUS_LABEL_KEY: Record<ContactStatusValue, string> = {
  pending: "newsletter.statusPending",
  active: "newsletter.statusActive",
  unsubscribed: "newsletter.statusUnsubscribed",
};

const STATUS_HINT_KEY: Record<ContactStatusValue, string> = {
  pending: "newsletter.statusHint.pending",
  active: "newsletter.statusHint.active",
  unsubscribed: "newsletter.statusHint.unsubscribed",
};

type ContactStatusLabelProps = {
  status: ContactStatusValue;
  /** Prefer short form keys (newsletter.pending) used in forms */
  shortLabel?: boolean;
  className?: string;
};

export function ContactStatusLabel({
  status,
  shortLabel = false,
  className,
}: ContactStatusLabelProps) {
  const { t } = useTranslation();
  const labelKey = shortLabel ? `newsletter.${status}` : STATUS_LABEL_KEY[status];

  return (
    <TooltipProvider delayDuration={200}>
      <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
        <span>{t(labelKey)}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              className="inline-flex shrink-0 text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              aria-label={t(STATUS_HINT_KEY[status])}
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[240px] text-xs leading-snug">
            {t(STATUS_HINT_KEY[status])}
          </TooltipContent>
        </Tooltip>
      </span>
    </TooltipProvider>
  );
}
