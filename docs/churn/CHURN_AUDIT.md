# Churn Phase 0 Audit

Date: 2026-10-10  
Scope: read-only inspection of current Churn Statistics page, Stripe webhooks, and subscription data model vs the business rules in the churn measurement plan (sections 1–3, 5, 11).

---

## 1. How the current Churn page calculates numbers

### UI
- Admin → Billing → **Statistics** tab (`client/src/pages/admin.tsx`).
- Renders two blocks via `ChurnStatisticsSection`: **Plan Churn** and **Add-on Churn**.
- Fetches `GET /api/admin/churn-stats` (React Query key `["/api/admin/churn-stats"]`).
- Shows: first subscription date, total subscriptions ever, true churned count, subscription churn %, lifetime churn %, this-year churn %, average monthly churn %, and a monthly table (subscriptions at start / churned / rate).

### Backend
| Piece | Location |
|--------|----------|
| Route | `server/routes.ts` → `GET /api/admin/churn-stats` (~10204) |
| Engine | `server/churn-stats.ts` → `computeProductChurnStats`, `filterRowsByProductType`, `buildLifecycles`, `resolveEndDate` |

### Current formulas (actual)

1. Load all `subscriptions` joined to `users` where `account_kind = customer`.
2. Split rows: `product_type === 'addon'` vs everything else as “plan”.
3. Build a **lifecycle per subscription row**:
   - `startDate` = `createdAt`
   - `endDate` = `cancelledAt`, else if status cancelled/canceled then `accessUntil`, else `null`
   - If any other subscription has `reactivationOf = this.id`, set `endDate = null` (treat as never truly churned).
4. **Subscription churn rate** = count(lifecycles with endDate) / count(all lifecycles).
5. **Lifetime churn rate** = unique users with ≥1 churned lifecycle / unique users with ≥1 lifecycle.
6. **This year** = churned in UTC calendar year / “active on Jan 1 UTC”.
7. **Monthly** (UTC month boundaries):
   - denominator = lifecycles started before month start and not ended before month start
   - numerator = lifecycles whose `endDate` falls in that UTC month
8. **Average monthly churn** = `lifetimeChurnRate / monthsSinceFirst` (not a true average of monthly rates).

### Deviations from target rules (section 1–3)

| Target rule | Current behavior |
|-------------|------------------|
| Logo churn = **customers** active at M_start (Athens) → not active at M_end | Counts **subscription rows**, UTC months; “lifetime” mixes customer uniqueness inconsistently with monthly subscription counts |
| Cancel click ≠ churn; churn at access end (R1) | End date prefers `cancelledAt` (often click/cancel time). App cancels Stripe **immediately** (`subscriptions.cancel`), not `cancel_at_period_end` |
| Same-month cancel + return = not churned | Only handled if `reactivationOf` is set manually/admin; no automatic event model |
| MRR / NRR / gross MRR churn | **Not computed** |
| Voluntary / involuntary split | **Not computed** |
| Pending cancellations / in dunning | **Not on page** |
| Expansion / contraction / reactivation MRR buckets | **Not computed** |
| Paused excluded (R8) | No pause status in churn engine |
| Multi-site: logo churn only when all cores ended (R7) | Each plan subscription row churns independently |
| Trial / incomplete not active (R15) | Any row with `createdAt` enters the universe; status filtering for “active” is weak |
| Closed months deterministic from event log | Computed from mutable `subscriptions` snapshot; rewriting `cancelledAt` / `reactivationOf` rewrites history |

---

## 2. Stripe webhooks handled + idempotency

### Endpoints
- Platform billing: `POST /api/webhook` (`server/routes.ts` ~5496), raw body + `STRIPE_WEBHOOK_SECRET`.
- Connect: separate Connect webhook handler earlier in the same file (seller payouts; not core logo churn).

### Event types handled on `/api/webhook` (switch cases found)
- `checkout.session.completed`
- `customer.subscription.deleted`
- `charge.failed`
- `charge.refunded`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.marked_uncollectible`
- `payment_intent.succeeded` (only when `metadata.action === 'add_subscription_items'`)

### Not handled (needed by plan §5)
- `customer.subscription.updated` (cancel_at_period_end, past_due, unpaid, pause, MRR item changes)
- `customer.subscription.created` (as expansion once paid)
- Explicit `invoice.paid` (we use `invoice.payment_succeeded` instead — close, but mapping must be aligned)

### Idempotency
- `event.id` is **logged** only (`Webhook received: … ID: event.id`).
- **No** table stores processed Stripe event IDs.
- Re-delivery can re-run side effects (risk depends on handler). **Not idempotent** per plan requirement (`stripe_event_id` unique).

---

## 3. DB model: customers, subscriptions, Stripe mapping

### Core tables
| Table | Role |
|-------|------|
| `users` | HAYC customer. `id`, `stripe_customer_id` (single nullable text), `account_kind`, billing fields |
| `subscriptions` | Per plan/addon row: `user_id`, `website_progress_id`, `product_type` (`plan`/`addon`), `tier`, `status`, Stripe ids, `price`, `billing_period`, `cancelled_at`, `access_until`, `cancellation_reason`, `reactivation_of`, etc. |
| `website_progress` | Sites owned by user; linked from subscriptions |
| `transactions` | Invoice payment rows tied to subscription |
| `payment_obligations` | Internal/Stripe payment tracking (used in payment-failure cancel path) |
| `stripe_prices` | Cached Stripe price ids / amounts / tier / billing period |

### Mapping HAYC customer ↔ Stripe
- One column: `users.stripe_customer_id`.
- No mapping table for **multiple** Stripe customers → one HAYC user (R14).
- Multiple sites = multiple `website_progress` (+ typically multiple plan subscriptions) under the same `users.id`.

### Event log
- **No** `subscription_events` (or equivalent append-only churn event log) exists today.

---

## 4. Core plan vs add-on vs setup fee

| Kind | How identified today | Reliable? |
|------|----------------------|-----------|
| Core plan | `subscriptions.product_type` default/`plan`; tiers `basic` / `essential` / `pro` (€44 / €49 / €200 in `subscriptionPlans`); Stripe price IDs via env + `stripe_prices` | OK for local rows; **no** Stripe `metadata.hayc_kind` convention enforced |
| Add-on | `product_type = 'addon'`; checkout metadata `addOnId`; `availableAddOns` | OK when checkout path sets it; sync/import paths must be checked carefully |
| Setup fee €120 | `STRIPE_SETUP_FEE_PRICE_ID` → tier `setup_fee` in `server/stripe/pricing.ts`; `subscriptionPlans.*.setupFee = 120`; one-time line on checkout | Price-id / tier based, **not** metadata. Not a subscription “active” by itself in app logic, but there is no churn event system yet |

**Proposal (if we adopt plan §11):** add Stripe Product/Price metadata `hayc_kind = core \| addon \| setup_fee` and a small config table mirroring it; stop hardcoding euro amounts in metric logic. Until then, local `product_type` + `stripe_prices.tier` is the practical marker — document risk for imported/orphan Stripe subs.

---

## 5. Where customers cancel + reason capture

| Path | Behavior | Reason |
|------|----------|--------|
| Customer UI `POST /api/subscriptions/:id/cancel` | **Immediate** `stripe.subscriptions.cancel` (not period-end schedule) | Hardcoded `"User requested cancellation"` |
| Admin `POST /api/admin/subscriptions/:id/cancel` | Immediate cancel (same pattern); admin supplies `reason` | Stored in `cancellation_reason` |
| Stripe Dashboard / dunning → `customer.subscription.deleted` | Local status → cancelled; reason filled if missing via `resolveStripeCancellationReason` (recently added: `payment_failed` + decline detail) | Partial |
| Stripe Customer Portal | **No** first-class portal cancel integration found in server cancel routes | N/A / unknown in prod config |
| `cancel_at_period_end` | **Not** used in cancel endpoints | R1 pending cancellations **cannot** work as specified without changing cancel behavior |

Cancellation feedback endpoint exists (`/api/cancellation-feedback`) for messaging; it is not the structured `reason_code` set from plan §6.

---

## 6. Dunning / retries (as inferred from code)

- `invoice.payment_failed`: creates/updates payment obligations; notes retry messaging; does **not** by itself set subscription to churned.
- `invoice.marked_uncollectible`: marks obligation failed, **cancels Stripe subscription**, sets local `cancellation_reason = payment_failed`.
- Final state after exhaustion in our code path: subscription **canceled** (not left as Stripe `unpaid` indefinitely — we actively cancel).
- Exact Stripe Smart Retries schedule: **not in repo** (Stripe account setting).
- Local obligations use `graceDays: 7` on create from `invoice.payment_failed`; status flips `retrying` vs `delinquent` from `invoice.next_payment_attempt`.

---

## 7. VAT inclusive vs exclusive

- Invoice amount helpers (`server/lib/stripe-invoice-amount.ts`) treat tax with `inclusive: false` as additive VAT to exclude from net.
- Wrapp path (`server/services/wrapp-api.ts`) assumes **24% VAT** and treats input amount as **gross** in places — inconsistent framing vs exclusive-tax helpers; confirm which is source of truth for MRR.
- Plan list prices in `subscriptionPlans` are the commercial “€44 / €49 / €200” figures; Stripe Price tax inclusivity must be confirmed in Stripe Dashboard.

**For MRR (plan §2):** prefer Stripe invoice line amounts **excluding exclusive VAT**, after discounts — reconcile Wrapp gross assumption before backfill sign-off.

---

## 8. Pause, trials, coupons

| Feature | In codebase? |
|---------|----------------|
| `pause_collection` | **No** handler found |
| Trials / `trialing` | UI treats `trialing` somewhat like active in places; churn engine does not implement R15 (active only after first paid recurring invoice) |
| Coupons / promos | Promo code system exists (`promo-codes`, checkout metadata); churn/MRR does not apply discount netting today |
| Incomplete / setup-only | Checkout can create incomplete flows; churn stats still may include rows once `subscriptions` exist with `createdAt` |

---

## 9. Pre-launch (R12)

- **No** dedicated `launched_at` / `published_at` on `website_progress`.
- Practical proxy already used elsewhere: `website_stages` row with `title = 'Website Launch'` and `status = 'completed'` → use `completed_at` as launch timestamp.
- Missing / incomplete Launch stage ⇒ treat as pre-launch (candidate rule; confirm before coding).

---

## 10. Blockers / decisions needed before Phase 1

Per plan: *if a rule cannot be implemented with available data, stop and report*.

### BLOCKING

1. **R1 vs current cancel behavior (and constraint §11)**  
   Target: cancel click → still active until period end; `cancel_scheduled` + Pending cancellations.  
   Actual: app calls `stripe.subscriptions.cancel` **immediately**.  
   Constraint: “Do not change Stripe billing behavior…”.  
   **Need decision:**  
   - (A) Change customer/admin cancel to `cancel_at_period_end` / `cancel_at` (billing behavior change; enables R1 properly), or  
   - (B) Keep immediate Stripe cancel and redefine R1 for HAYC (churn at `cancelledAt`, use `accessUntil` only for product access), accepting deviation from the written R1.

2. **R14 multi–Stripe-customer mapping**  
   Only `users.stripe_customer_id`.  
   **Need decision:** build `user_stripe_customers` mapping + optional admin merge now, or defer until a real multi-customer case exists?

3. **R12 pre_launch**  
   Candidate: `website_stages` where `title = 'Website Launch'` → `completed_at`.  
   **Need decision:** approve this proxy, or add explicit `launched_at`?

4. **Plan identity for filters (€44 / €49 / €200)**  
   Local `tier` / `product_id` works for normal checkout; no `metadata.hayc_kind`.  
   **Need decision:** require Stripe metadata backfill before metrics, or accept `subscriptions.tier` + `stripe_prices` for v1?

### Extra nuance from deeper audit
- `reactivationOf` only **clears churn on the prior cancelled row**; the new subscription still starts a new lifecycle at its `createdAt` (so “not a new customer” is **not** how current stats work).
- Customer cancel + addon cancel set lifecycle end at **cancel time** (`cancelledAt`), not period end — conflicts with R1/T1 even before Athens/MRR work.

### NON-BLOCKING (implementable in Phase 1+)

- Append-only `subscription_events` + reason audit table (new tables; OK under “do not delete/alter existing”).
- Webhook idempotency via `stripe_event_id`.
- Athens month boundaries in metrics service.
- Customer-level logo churn from event log.
- Backfill script with approximation log.
- Rebuild Statistics / Churn page per §9.
- Tests T1–T15 against fixtures.

### Important product note (even if not blocking schema)

- Without (A) on cancel-at-period-end, **Pending cancellations** and T1/T2 cannot match the written scenarios against live Stripe state.

---

## 11. Phase 0 conclusion

- Current Churn Statistics are **subscription-row / UTC / cancellation-timestamp** metrics with optional `reactivationOf` exclusion. They are **not** logo churn under the new definition and do not expose MRR movements.
- Webhooks cover checkout + some invoice/delete paths; missing `customer.subscription.updated`; **not idempotent** by event id.
- Data model can support the new design via **new** event tables keyed by `users.id`, but several rules need product decisions (especially R1 cancel semantics).

**Stopped before Phase 1** pending decisions on §10 blockers 1–4.
