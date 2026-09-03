import { useCallback, useEffect, useState } from "react";
import { clearPurchaseSuccessQueryParam, hasPurchaseSuccessQueryParam } from "@/lib/hdp-widget";

export function useHdpPurchaseSuccess(): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasPurchaseSuccessQueryParam()) return;
    setVisible(true);
    clearPurchaseSuccessQueryParam();
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return { visible, dismiss };
}
