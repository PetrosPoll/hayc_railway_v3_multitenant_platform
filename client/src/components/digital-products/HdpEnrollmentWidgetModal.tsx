import { useCallback, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { buildHdpWidgetUrl } from "@/lib/hdp-widget";
import { useHdpWidgetMessages } from "@/hooks/use-hdp-widget-messages";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  courseId: string | null;
  /** Admin preview mode — passes preview=true to HDP widget URL. */
  preview?: boolean;
  /** Defaults to window.location.href */
  returnUrl?: string;
};

export function HdpEnrollmentWidgetModal({
  open,
  onOpenChange,
  siteId,
  courseId,
  preview = false,
  returnUrl,
}: Props) {
  const closeModal = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSuccess = useCallback(() => {
    closeModal();
    window.location.reload();
  }, [closeModal]);

  const handleCheckout = useCallback(
    (url: string) => {
      closeModal();
      window.location.href = url;
    },
    [closeModal],
  );

  useHdpWidgetMessages({
    enabled: open,
    onSuccess: handleSuccess,
    onCheckout: handleCheckout,
    onClose: closeModal,
  });

  const iframeSrc = useMemo(() => {
    if (!courseId) return null;
    const resolvedReturnUrl =
      returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined);
    return buildHdpWidgetUrl({
      siteId,
      courseId,
      returnUrl: resolvedReturnUrl,
      preview,
    });
  }, [siteId, courseId, returnUrl, preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] sm:max-w-5xl p-0 gap-0 flex flex-col max-h-[95vh] overflow-hidden border-0 bg-background [&>button]:z-10">
        <div className="flex w-full flex-1 flex-col min-h-0">
          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              title="HDP enrollment"
              className="block w-full min-h-[420px] sm:min-h-[560px] flex-1 border-0 bg-background"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
