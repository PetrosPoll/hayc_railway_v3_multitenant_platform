# Runbook — Calendar v2 production deploy

Staging first. Production only after staging sign-off (`STAGING_TEST_PLAN.md`).

**No historical backfill.** After deploy, Sync / nightly jobs materialize **forward** entries only. Past calendar history is not reconstructed.

## Staging

1. Deploy calendar-v2 branch to Railway staging.  
2. Backup staging DB optional but recommended.  
3. Run migrations (`0033_calendar_v2_obligations`) via app startup or `npm run db:migrate`.  
4. Open Subscription Calendar; click Sync (reconcile + materialize next 90 days).  
5. Walk `STAGING_TEST_PLAN.md` with **new** Stripe/custom activity (test clocks / new series).

## Production

1. **Backup production Postgres** (Railway backup / snapshot). Do not skip.  
2. Deploy the same commit that passed staging.  
3. Confirm migration `0033` applied.  
4. Click Sync Invoices (reconcile).  
5. Spot-check: one active Stripe upcoming row; create a small custom series and confirm materialization.  
6. Confirm nightly job: after next Athens 03:00, logs show `[SCHEDULER] Billing calendar nightly`.

## Rollback

1. Redeploy previous production image/commit.  
2. Forward-fix preferred; emergency only: restore DB from pre-deploy backup.

## Post-deploy checks

- [ ] No duplicate settled rows for same `(subscription_id, period_start)`  
- [ ] Failed payment creates one admin notification  
- [ ] `charge.failed` does not double-email  
- [ ] New custom / Stripe charges appear with correct status going forward  

## Customer emails

| Template | Default |
|----------|---------|
| failed | ON |
| refunded | ON |
| card-expiring | ON (nightly, once per card) |
| action_required, cancel_confirmed, ending_soon, offline_* | OFF until copy approved (`app_settings`) |
