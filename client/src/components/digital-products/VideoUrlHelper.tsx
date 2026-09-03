import { ChevronDown } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const HELPER_IMAGE_SRC = "/images/youtube-studio-video-link-helper.png";

export function VideoUrlHelper() {
  const { t } = useTranslation();

  return (
    <Collapsible className="rounded-md border border-border/70 bg-muted/30">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
        <span>{t("digitalProductsManagement.courseEditor.videoUrlHelper.trigger")}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t border-border/60 px-3 py-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">
          {t("digitalProductsManagement.courseEditor.videoUrlHelper.title")}
        </p>

        <div className="space-y-2">
          <p className="font-medium text-foreground">
            {t("digitalProductsManagement.courseEditor.videoUrlHelper.youtubeTitle")}
          </p>
          <ol className="list-decimal space-y-1.5 pl-4">
            <li>{t("digitalProductsManagement.courseEditor.videoUrlHelper.youtubeStep1")}</li>
            <li>
              <Trans
                i18nKey="digitalProductsManagement.courseEditor.videoUrlHelper.youtubeStep2"
                components={{ bold: <strong className="text-foreground" /> }}
              />
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>
                  <Trans
                    i18nKey="digitalProductsManagement.courseEditor.videoUrlHelper.youtubePublic"
                    components={{ bold: <strong className="text-foreground" /> }}
                  />
                </li>
                <li>
                  <Trans
                    i18nKey="digitalProductsManagement.courseEditor.videoUrlHelper.youtubePrivate"
                    components={{ bold: <strong className="text-foreground" /> }}
                  />
                </li>
                <li>
                  <Trans
                    i18nKey="digitalProductsManagement.courseEditor.videoUrlHelper.youtubeUnlisted"
                    components={{ bold: <strong className="text-foreground" /> }}
                  />
                </li>
              </ul>
            </li>
            <li>{t("digitalProductsManagement.courseEditor.videoUrlHelper.youtubeStep3")}</li>
            <li>
              <Trans
                i18nKey="digitalProductsManagement.courseEditor.videoUrlHelper.youtubeStep4"
                components={{ bold: <strong className="text-foreground" /> }}
              />
            </li>
            <li>{t("digitalProductsManagement.courseEditor.videoUrlHelper.youtubeStep5")}</li>
          </ol>

          <figure className="space-y-1.5 pt-1">
            <img
              src={HELPER_IMAGE_SRC}
              alt={t("digitalProductsManagement.courseEditor.videoUrlHelper.screenshotAlt")}
              className="w-full max-w-md rounded-md border border-border bg-background"
              loading="lazy"
            />
            <figcaption className="text-[11px] leading-snug text-muted-foreground">
              {t("digitalProductsManagement.courseEditor.videoUrlHelper.screenshotCaption")}
            </figcaption>
          </figure>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground">
            {t("digitalProductsManagement.courseEditor.videoUrlHelper.vimeoTitle")}
          </p>
          <ol className="list-decimal space-y-1.5 pl-4">
            <li>{t("digitalProductsManagement.courseEditor.videoUrlHelper.vimeoStep1")}</li>
            <li>{t("digitalProductsManagement.courseEditor.videoUrlHelper.vimeoStep2")}</li>
            <li>{t("digitalProductsManagement.courseEditor.videoUrlHelper.vimeoStep3")}</li>
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
