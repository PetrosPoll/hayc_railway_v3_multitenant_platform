import { isContactCardPath } from "@shared/contact-cards";
import { isLandingPageRoute } from "@/lib/landing-routes";

export function shouldSkipAuthCheck(pathname: string): boolean {
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return true;
  return isLandingPageRoute(pathname) || isContactCardPath(pathname);
}
