import { isContactCardPath } from "@shared/contact-cards";
import { isLandingPageRoute } from "@/lib/landing-routes";

export function shouldSkipAuthCheck(pathname: string): boolean {
  return isLandingPageRoute(pathname) || isContactCardPath(pathname);
}
