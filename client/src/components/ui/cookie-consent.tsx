import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyConsent,
  consentRequiresReload,
  COOKIE_CONSENT_UPDATED_EVENT,
  getStoredConsent,
  saveConsent,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent";

type CookieConsentContextValue = {
  consent: CookieConsentPreferences | null;
  openPreferences: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function useCookieConsent(): CookieConsentContextValue {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return context;
}

function CategoryRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white font-brand">{title}</p>
        <p className="text-sm text-white/70 font-brand">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [consent, setConsent] = useState<CookieConsentPreferences | null>(() => getStoredConsent());
  const [bannerVisible, setBannerVisible] = useState(() => getStoredConsent() === null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [draftMarketing, setDraftMarketing] = useState(false);

  const syncFromStorage = useCallback(() => {
    const stored = getStoredConsent();
    setConsent(stored);
    setBannerVisible(stored === null);
    if (stored) {
      applyConsent(stored);
    }
  }, []);

  useEffect(() => {
    syncFromStorage();

    const handleUpdate = () => syncFromStorage();
    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleUpdate);
  }, [syncFromStorage]);

  const openPreferences = useCallback(() => {
    const stored = getStoredConsent();
    setDraftAnalytics(stored?.analytics ?? false);
    setDraftMarketing(stored?.marketing ?? false);
    setPreferencesOpen(true);
    setBannerVisible(false);
  }, []);

  const commitConsent = useCallback(
    (analytics: boolean, marketing: boolean) => {
      const previous = getStoredConsent();
      const next = saveConsent({ analytics, marketing });
      setConsent(next);
      setBannerVisible(false);
      setPreferencesOpen(false);
      applyConsent(next);

      if (consentRequiresReload(previous, next)) {
        window.location.reload();
      }
    },
    [],
  );

  const handleAcceptAll = () => commitConsent(true, true);
  const handleRejectNonEssential = () => commitConsent(false, false);
  const handleSavePreferences = () => commitConsent(draftAnalytics, draftMarketing);

  const contextValue = useMemo(
    () => ({ consent, openPreferences }),
    [consent, openPreferences],
  );

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}

      {bannerVisible && (
        <div
          className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#00070f]/95 p-4 shadow-2xl backdrop-blur-md sm:p-6"
          role="dialog"
          aria-live="polite"
          aria-label={t("cookieConsent.title")}
          data-testid="cookie-consent-banner"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 lg:max-w-3xl">
              <p className="text-base font-semibold text-white font-brand">{t("cookieConsent.title")}</p>
              <p className="text-sm text-white/75 font-brand">
                {t("cookieConsent.description")}{" "}
                <Link to="/cookie-policy" className="underline underline-offset-2 hover:text-white">
                  {t("cookieConsent.cookiePolicyLink")}
                </Link>{" "}
                {t("cookieConsent.and")}{" "}
                <Link to="/privacy-policy" className="underline underline-offset-2 hover:text-white">
                  {t("cookieConsent.privacyPolicyLink")}
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap lg:shrink-0 lg:items-center lg:gap-3">
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={openPreferences}
                data-testid="button-cookie-customize"
              >
                {t("cookieConsent.customize")}
              </Button>
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={handleRejectNonEssential}
                data-testid="button-cookie-reject"
              >
                {t("cookieConsent.rejectNonEssential")}
              </Button>
              <div className="hidden lg:block h-8 w-px bg-white/20" />
              <Button
                className="bg-[#A0BAF3] hover:opacity-80 border-0 text-[#00070f] font-brand font-semibold"
                onClick={handleAcceptAll}
                data-testid="button-cookie-accept"
              >
                {t("cookieConsent.acceptAll")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={preferencesOpen}
        onOpenChange={(open) => {
          setPreferencesOpen(open);
          if (!open && getStoredConsent() === null) {
            setBannerVisible(true);
          }
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#00070f] text-white sm:max-w-md"
          closeBtnClassName="h-7 w-7 min-h-0 min-w-0 sm:h-7 sm:w-7 sm:min-h-0 sm:min-w-0 right-3 top-3 sm:right-3 sm:top-3"
        >
          <DialogHeader className="pb-1">
            <DialogTitle className="font-brand text-white text-lg">{t("cookieConsent.preferencesTitle")}</DialogTitle>
            <DialogDescription className="text-white/70 font-brand text-sm">
              {t("cookieConsent.preferencesDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <CategoryRow
              title={t("cookieConsent.categories.necessary.title")}
              description={t("cookieConsent.categories.necessary.description")}
              checked
              disabled
            />
            <CategoryRow
              title={t("cookieConsent.categories.analytics.title")}
              description={t("cookieConsent.categories.analytics.description")}
              checked={draftAnalytics}
              onCheckedChange={setDraftAnalytics}
            />
            <CategoryRow
              title={t("cookieConsent.categories.marketing.title")}
              description={t("cookieConsent.categories.marketing.description")}
              checked={draftMarketing}
              onCheckedChange={setDraftMarketing}
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => {
                setPreferencesOpen(false);
                if (getStoredConsent() === null) {
                  setBannerVisible(true);
                }
              }}
            >
              {t("cookieConsent.cancel")}
            </Button>
            <Button
              className="bg-[#A0BAF3] hover:opacity-80 border-0 text-[#00070f] font-brand font-semibold"
              onClick={handleSavePreferences}
              data-testid="button-cookie-save-preferences"
            >
              {t("cookieConsent.savePreferences")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CookieConsentContext.Provider>
  );
}
