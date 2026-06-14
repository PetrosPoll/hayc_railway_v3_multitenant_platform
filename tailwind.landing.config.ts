import type { Config } from "tailwindcss";
import baseConfig from "./tailwind.config";

export default {
  ...baseConfig,
  content: [
    "./client/index.html",
    "./client/src/LandingApp.tsx",
    "./client/src/pages/website-creation*.tsx",
    "./client/src/lib/landing-page*.ts",
    "./client/src/lib/landing-routes.ts",
    "./client/src/lib/landing-page-styles.ts",
    "./client/src/lib/hayc-newsletter-subscribe.ts",
    "./client/src/components/landing/**/*.tsx",
    "./client/src/components/ui/button.tsx",
    "./client/src/components/ui/input.tsx",
    "./client/src/components/ui/card.tsx",
    "./client/src/components/ui/form.tsx",
    "./client/src/components/ui/accordion.tsx",
    "./client/src/components/ui/label.tsx",
    "./client/src/components/ui/checkbox.tsx",
    "./client/src/components/ui/dialog.tsx",
    "./client/src/components/ui/switch.tsx",
    "./client/src/components/ui/cookie-consent.tsx",
    "./client/src/components/ui/review-widget.tsx",
    "./client/src/hooks/use-noindex.ts",
  ],
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
