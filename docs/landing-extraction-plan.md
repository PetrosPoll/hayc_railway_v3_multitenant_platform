# Landing Page Extraction Plan (Future)

Goal: move the marketing landing pages into a separate, ultra-light static SPA that talks to the existing hayc backend over a few public HTTP endpoints. Do this LATER. Short term we instead do in-place lazy loading (see last section).

## 1. Scope — what gets extracted

Route entry: `/fast-and-affordable-websites-book-a-call` and `...-en` (+ `version-1..5` variants).

Self-contained files (none import the backend, `@shared`, DB, or auth):

```
client/src/LandingApp.tsx
client/src/lib/landing-routes.ts
client/src/pages/website-creation-routes.tsx
client/src/pages/website-creation.tsx
client/src/components/landing/deferred-landing-cookie-consent.tsx
client/src/components/landing/landing-newsletter-opt-in-field.tsx
client/src/components/landing/landing-vimeo-embed.tsx
client/src/components/ui/cookie-consent.tsx
client/src/components/ui/{button,input,card,form,accordion}.tsx   (+ cn from lib/utils)
client/src/lib/utm.ts
client/src/lib/tracking.ts
client/src/lib/cookie-consent.ts
client/src/lib/landing-preloads.ts
client/src/lib/landing-page-styles.ts
client/src/lib/landing-page-variants.ts
client/src/lib/landing-vimeo-videos.ts
client/src/lib/vimeo-oembed.ts
client/src/lib/get-started-default-path.ts
client/src/lib/hayc-newsletter-subscribe.ts
client/src/lib/load-keak.ts
client/src/hooks/use-noindex.ts
client/src/landing-fonts.ts
client/src/landing.css
i18n setup + ONLY the `landingPage.*` slice of en.json / gr.json
```

Drop on the way out: `components/ui/review-widget.tsx` (imported but unused).

## 2. Backend relationship (the only coupling)

4 public, unauthenticated REST endpoints (`server/routes.ts`):

| Endpoint | Backend action | DB |
|---|---|---|
| `POST /api/submit-lead` | admin email + HubSpot lead | none |
| `POST /api/update-meeting-booked` | update HubSpot contact | none |
| `POST /api/debug-meeting-event` | log only | none |
| `POST /api/hayc/newsletter-subscribe` | insert into `adminContacts` | yes (1 insert) |

Third-party loaded client-side (no backend): HubSpot meetings embed, Vimeo, Keak, GA, Meta Pixel, fonts.

One product coupling: the "Get started" CTA navigates to in-SPA `/get-started` (owned by MainApp). In the standalone app this becomes an absolute URL to the main app.

## 3. New project setup

- Vite + React + TS + Tailwind, pure static SPA (no Node server).
- Host: Cloudflare Pages / Vercel / Netlify.
- Copy the files from section 1; copy only the `landingPage` translation subtree into `en.json` / `gr.json`.
- Keep facade patterns as-is (Vimeo thumbnail-on-click, deferred cookie consent, deferred third-party scripts).

## 4. Wiring to the backend

Pick one:
- **A (simplest):** serve the new app on the same parent domain and path-route `/api/*` to the hayc backend (reverse proxy). No CORS needed.
- **B:** point fetches at `https://<hayc-host>/api/...` and add CORS (allow-origin = landing domain, `POST`, `Content-Type`) to the 4 routes above. CORS pattern already exists for some routes in `routes.ts`.

Config:
- Introduce `VITE_API_BASE_URL` (empty for option A, full host for option B) and prefix the 4 fetch calls.
- Introduce `VITE_MAIN_APP_URL`; set `get-started-default-path.ts` to `${VITE_MAIN_APP_URL}/get-started?plan=essential&billing=monthly`.

Optional further decoupling: 3 of the 4 endpoints are thin HubSpot/email proxies — could be reimplemented as serverless functions in the new project, leaving only `newsletter-subscribe` pointed at hayc.

## 5. Cutover

1. Deploy standalone app at a staging URL; verify all 4 endpoints + HubSpot meeting flow + GA/Pixel consent.
2. Point production landing domain/path at the new app.
3. Remove the two landing `<Route>`s from `client/src/App.tsx`, delete extracted files, drop the unused `review-widget`, and make `LandingApp` no longer eager in the main bundle.
4. Verify main app bundle shrank (i18n locales + RHF/zod no longer pulled by landing).

## 6. Risks / checklist

- [ ] CORS / cookies for HubSpot embed under new origin
- [ ] GA `G-RGCJJSJEY0` + Meta Pixel `590733836695526` fire under new domain
- [ ] UTM capture works (uses sessionStorage, origin-scoped)
- [ ] noindex meta still applied on variant pages
- [ ] Greek/English font preloads scoped to active language

---

## Short-term (DO NOW): in-place lazy loading

Gets ~80% of the speed win with no new infra:
1. Lazy-load translations — load only `landingPage.*` for the landing route (split JSON or i18next namespaces) instead of bundling full en+gr (~400 KB) in the entry chunk.
2. Preload only the active language's fonts (not all 4 woff2).
3. Lazy-load / replace zod + react-hook-form for the 2-field form.
4. Add `manualChunks` vendor splitting in `vite.config.ts`.
5. Remove the unused `review-widget` import in `website-creation.tsx`.
