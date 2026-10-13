# Staging test plan — Calendar v2

Use **Stripe test mode** on the staging Railway app + staging DB. Prefer [Stripe Test Clocks](https://docs.stripe.com/billing/testing/test-clocks) to advance time.

After deploy: run migrations, then click **Sync** once.  
**No historical backfill** — validate with new Stripe/custom activity going forward.

## Prep

1. Log in as administrator on staging.  
2. Open Admin → Subscription Calendar.  
3. Click Sync (reconcile) once; confirm toast.

## Scenarios

### 1. Monthly renewal paid
- Create/use a test subscription (monthly). Advance clock past period end so invoice pays.  
- **Expect:** one `settled` entry; one `transactions` row; Εισπράχθηκαν increases. Sync again → no duplicate.

### 2. Fail → retry → success
- Pay with `4000000000000341` (attach fail then succeed) or fail invoice then pay.  
- **Expect:** same obligation: `retrying` (attempt 1) → `retrying` (2) → `settled`. History ≥ 3 rows.

### 3. Fail → exhausted → uncollectible
- Use declining card until no `next_payment_attempt`, or mark invoice uncollectible from calendar.  
- **Expect:** `delinquent` → `written_off`; future rows `stopped`; subscription canceled.

### 4. SCA / action_required
- Card `4000002500003155`.  
- **Expect:** `action_required`; after auth/pay → `settled`.

### 5. Cancel at period end + revert
- Customer portal / API: `cancel_at_period_end=true`.  
- **Expect:** future entry `will_not_renew`, excluded from Σύνολο. Revert → `upcoming`. Admin notification.

### 6. Plan change €49 → €44 / add-on
- Change price or remove add-on.  
- **Expect:** future entry amount updates; history note from sync.

### 7. Schedule `sub_sched_*`
- Subscription created via schedule.  
- **Expect:** upcoming entry exists; after release/remap to `sub_*`, same logical row (no duplicate period).

### 8. Yearly
- Yearly plan.  
- **Expect:** one entry near `current_period_end` within 90 days (or none if &gt;90d out).

### 9. Pause / resume
- Set `pause_collection`.  
- **Expect:** `paused` → after resume `upcoming`.

### 10. Refunds
- Full and partial refund in Stripe.  
- **Expect:** `refunded` / `partially_refunded`; totals net correctly; Χάθηκαν includes refunded €.

### 11. Dispute
- Create test dispute; close won/lost.  
- **Expect:** `disputed` → `settled` (won) or `refunded` (lost).

### 12. Duplicate / out-of-order webhooks
- Resend same event from Stripe CLI.  
- **Expect:** `duplicate: true`; no second obligation/transaction.

### 13. Missed webhook → reconcile
- Suppress one event; click Sync.  
- **Expect:** entry corrected; history `source=reconcile` or sync.

### 14. Custom Jan 31
- Create monthly custom starting 31 Jan.  
- **Expect:** Feb 28/29, Mar 31 occurrences.

### 15. Custom aging
- Create custom due yesterday / 8+ days ago (or advance server Athens date).  
- **Expect:** `pending` → `grace` → `delinquent` after nightly (or trigger aging via sync path / wait for 03:00 Athens). Next occurrence still generated.

### 16. Settle amount / partial / unsettle
- Mark paid €49 → settlement 4900 cents (not 490000). Partial then settle. Unsettle → aged status.

### 17. Forward-only custom (no history backfill)
- Create a **new** custom series; confirm next 90 days materialize as `upcoming`/`pending`.  
- Do **not** expect past months to be reconstructed.

### 18. Card expiring
- Card expiring next month. After nightly: flag + one email log; second night no resend.

### 19. Failed email once
- Force payment_failed; confirm one `failed` email (not also from charge.failed).

### 20. Totals fixture
- Mixed statuses in one month; compare cards to formulas in `PAYMENT_STATUSES.md`.

## Sign-off

- [ ] Forward scenarios checked on staging  
- [ ] New Stripe/custom charges show correct statuses  
- [ ] Ready for production runbook  
