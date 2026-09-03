import { useEffect } from "react";
import { isAllowedHdpWidgetOrigin, parseHdpWidgetMessage } from "@/lib/hdp-widget";

type Options = {
  enabled?: boolean;
  /** When false, skip origin check (e.g. local dev). Default: true in production builds. */
  verifyOrigin?: boolean;
  onSuccess: () => void;
  onCheckout: (url: string) => void;
  onClose: () => void;
};

export function useHdpWidgetMessages({
  enabled = true,
  verifyOrigin = true,
  onSuccess,
  onCheckout,
  onClose,
}: Options): void {
  useEffect(() => {
    if (!enabled) return;

    function onWidgetMessage(event: MessageEvent) {
      if (verifyOrigin && !isAllowedHdpWidgetOrigin(event.origin)) return;
      const message = parseHdpWidgetMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case "hdp-widget-success":
          onSuccess();
          break;
        case "hdp-widget-checkout":
          onCheckout(message.url);
          break;
        case "hdp-widget-close":
          onClose();
          break;
      }
    }

    window.addEventListener("message", onWidgetMessage);
    return () => window.removeEventListener("message", onWidgetMessage);
  }, [enabled, verifyOrigin, onSuccess, onCheckout, onClose]);
}
