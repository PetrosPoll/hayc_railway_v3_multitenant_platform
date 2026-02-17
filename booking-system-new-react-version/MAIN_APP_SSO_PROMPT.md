# Main platform (hayc.gr): What to do when the user clicks “Booking”

When a logged-in business owner clicks **“Booking”** or **“Bookings”** for a specific website in the main platform (hayc.gr), the main app must send them to the booking subdomain with a **short-lived SSO token** so they land in the correct account without logging in again.

---

## 1. When the user clicks “Booking” (or “Bookings”) for a website

- The main platform must **redirect the browser** to the booking app with a single-use or short-lived token in the URL.

---

## 2. Redirect URL

Use exactly:

- **`https://booking.hayc.gr/sso?token=<JWT>`**

Optional: add `&returnUrl=<encoded-path>` if you want to send them to a specific booking app path after SSO (e.g. `/dashboard/bookings`). The booking app may support this later.

---

## 3. Token contents (JWT payload)

The token must be a **JWT** signed with a **shared secret** that the booking app will verify (they set `SSO_JWT_SECRET` to the same value).

**Required claim:**

- **`websiteId`** (string): the ID of the website the user is opening Bookings for (your internal website/site ID). The booking app will look up the business with `external_website_id = websiteId` and scope the whole session to that business.

**Recommended claims** (so the booking app can identify or create the user and show their name):

- **`userId`** (string): your internal user ID for the logged-in owner.
- **`email`** (string): owner’s email.
- **`firstName`** (string): owner’s first name.
- **`lastName`** (string): owner’s last name.
- **`role`** (string): e.g. `"business_owner"`.

**Expiry:** keep the token short-lived (e.g. 1–5 minutes). The booking app will exchange it once and issue its own session token. Use standard JWT `exp` (and optionally `iat`).

---

## 4. Signing the JWT

- Sign the JWT with the **same secret** you will share with the booking app (e.g. a long random string).
- The booking app sets this as **`SSO_JWT_SECRET`** and uses it only to verify this SSO token.
- Algorithm: **HS256** (symmetric secret) is simplest.

---

## 5. Example (pseudo-code)

- User is on hayc.gr, logged in, and selects a website with `websiteId = "abc-123"`.
- User clicks “Booking”.
- Build payload:
  - `websiteId: "abc-123"`
  - `userId: currentUser.id`
  - `email: currentUser.email`
  - `firstName: currentUser.firstName`
  - `lastName: currentUser.lastName`
  - `role: "business_owner"`
  - `exp: now + 5*60` (e.g. 5 minutes)
- Sign: `jwt.sign(payload, SSO_JWT_SECRET, { algorithm: 'HS256' })`.
- Redirect: `window.location.href = "https://booking.hayc.gr/sso?token=" + token`.

---

## 6. Prerequisites on the main platform

- Only redirect to booking when the user is **logged in** and has permission to manage that website.
- Ensure that for each website that has “Booking” enabled, the **booking app** has a business with **`external_website_id`** set to that website’s ID. (Either the main platform creates/syncs that business via an API, or it is created once in the booking app and linked to the same `websiteId`.)

---

## 7. What the booking app does

- It validates the token, finds the business by `websiteId`, ensures the user is the owner (by email or by existing ownership), then logs them in and shows the dashboard for **that** business only.

---

## Implementation (main platform hayc.gr)

The following has been implemented:

- **API endpoint:** `GET /api/booking/sso-token?websiteId=<id>`
  - Requires authenticated user.
  - Verifies the user has permission to manage the website (owner, admin, or staff with `canViewWebsites`).
  - Returns `{ token, redirectUrl }` with a 5-minute JWT.

- **Environment variables:**
  - `SSO_JWT_SECRET` (required): Shared secret for signing the JWT. Must match the booking app’s `SSO_JWT_SECRET`.
  - `BOOKING_APP_URL` (optional): Base URL for the booking app. Default: `https://booking.hayc.gr`.

- **UI:** “Booking” button added to:
  - Websites list (`/dashboard`) – per-website card
  - Website dashboard sidebar (`/dashboard/website/:websiteId`)
