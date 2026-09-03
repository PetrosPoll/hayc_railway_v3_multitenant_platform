import type { ReactNode } from "react";
import { HdpPurchaseSuccessBanner } from "@/components/digital-products/HdpPurchaseSuccessBanner";

type Props = {
  children?: ReactNode;
  showPurchaseBanner?: boolean;
};

/** Mount once on site layout — shows post-checkout success banner only. */
export function HdpEnrollHost({ children, showPurchaseBanner = true }: Props) {
  return (
    <>
      {showPurchaseBanner ? <HdpPurchaseSuccessBanner /> : null}
      {children}
    </>
  );
}
