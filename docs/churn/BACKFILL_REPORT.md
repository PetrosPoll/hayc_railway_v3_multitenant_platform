# Churn backfill report

Generated: 2026-10-10T00:14:08.469Z
dryRun: false
events_cutover_at: 2026-10-09T23:12:15.037Z

## Summary
- Customers processed: 7
- Backfill events cleared: 51
- launched_at updates: 4
- customer_stripe_accounts seeded: 7
- stripe_price_map seed writes: 17
- Unmapped Stripe price IDs: 0
- Approximations logged: 2
- Active customers (live Stripe, ≥1 core sub): 2
- Total MRR ex-VAT (cents): 44200
- ARPA ex-VAT (cents): 22100 (€221.00)

## ARPA (ex VAT)

| metric | value |
|---|---|
| active_customers | 2 |
| mrr_cents_ex_vat | 44200 |
| arpa_cents_ex_vat | 22100 |

## Logo churn (last 12 months) — sanity table

Mode: **stripe-history**. Cohort = ≥1 core Stripe sub covering month start → none at next month start.

| month | customers_start | churned_count | logo_churn_pct | mrr_movements |
|---|---|---|---|---|
| 2025-11 | 0 | 0 | n/a | ok / mixed |
| 2025-12 | 0 | 0 | n/a | ok / mixed |
| 2026-01 | 0 | 0 | n/a | ok / mixed |
| 2026-02 | 0 | 0 | n/a | ok / mixed |
| 2026-03 | 0 | 0 | n/a | ok / mixed |
| 2026-04 | 0 | 0 | n/a | ok / mixed |
| 2026-05 | 0 | 0 | n/a | ok / mixed |
| 2026-06 | 0 | 0 | n/a | ok / mixed |
| 2026-07 | 0 | 0 | n/a | ok / mixed |
| 2026-08 | 0 | 0 | n/a | ok / mixed |
| 2026-09 | 1 | 0 | 0 | ok / mixed |
| 2026-10 | 4 | 2 | 50 | ok / mixed |

## Unmapped price IDs
(none)

## Approximations
- customer 48: cutover reconcile churn (0 live cores)
- customer 49: cutover reconcile churn (0 live cores)

## Duplicate candidates
### Same email
```
{
  "command": "SELECT",
  "rowCount": 0,
  "oid": null,
  "rows": [],
  "fields": [
    {
      "name": "key",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 25,
      "dataTypeSize": -1,
      "dataTypeModifier": -1,
      "format": "text"
    },
    {
      "name": "n",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 23,
      "dataTypeSize": 4,
      "dataTypeModifier": -1,
      "format": "text"
    },
    {
      "name": "ids",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 1007,
      "dataTypeSize": -1,
      "dataTypeModifier": -1,
      "format": "text"
    }
  ],
  "_parsers": [
    null,
    null,
    null
  ],
  "_types": {},
  "RowCtor": null,
  "rowAsArray": false,
  "_prebuiltEmptyResultObject": {
    "key": null,
    "n": null,
    "ids": null
  }
}
```
### Same VAT
```
{
  "command": "SELECT",
  "rowCount": 0,
  "oid": null,
  "rows": [],
  "fields": [
    {
      "name": "key",
      "tableID": 16687,
      "columnID": 11,
      "dataTypeID": 25,
      "dataTypeSize": -1,
      "dataTypeModifier": -1,
      "format": "text"
    },
    {
      "name": "n",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 23,
      "dataTypeSize": 4,
      "dataTypeModifier": -1,
      "format": "text"
    },
    {
      "name": "ids",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 1007,
      "dataTypeSize": -1,
      "dataTypeModifier": -1,
      "format": "text"
    }
  ],
  "_parsers": [
    null,
    null,
    null
  ],
  "_types": {},
  "RowCtor": null,
  "rowAsArray": false,
  "_prebuiltEmptyResultObject": {
    "key": null,
    "n": null,
    "ids": null
  }
}
```
### Same domain, multiple users
```
{
  "command": "SELECT",
  "rowCount": 0,
  "oid": null,
  "rows": [],
  "fields": [
    {
      "name": "key",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 25,
      "dataTypeSize": -1,
      "dataTypeModifier": -1,
      "format": "text"
    },
    {
      "name": "n",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 23,
      "dataTypeSize": 4,
      "dataTypeModifier": -1,
      "format": "text"
    },
    {
      "name": "ids",
      "tableID": 0,
      "columnID": 0,
      "dataTypeID": 1007,
      "dataTypeSize": -1,
      "dataTypeModifier": -1,
      "format": "text"
    }
  ],
  "_parsers": [
    null,
    null,
    null
  ],
  "_types": {},
  "RowCtor": null,
  "rowAsArray": false,
  "_prebuiltEmptyResultObject": {
    "key": null,
    "n": null,
    "ids": null
  }
}
```

## Live Stripe MRR snapshot (ex VAT, per customer)
| customerId | email | mrr_cents | active_cores |
|---|---|---|---|
| 37 | support@hayc.gr | 38300 | 7 |
| 43 | chris05mavr@gmail.com | 0 | 0 |
| 44 | chris06mavr@gmail.com | 0 | 0 |
| 45 | blatsos2014@gmail.com | 0 | 0 |
| 47 | pollakis.p673@gmail.com | 5900 | 1 |
| 48 | pollakis.p367@gmail.com | 0 | 0 |
| 49 | XXXX@gmail.com | 0 | 0 |

## Notes
- Logo timeline rebuilt from Stripe subscriptions (core coverage intervals).
- MRR from Stripe price items at each sub (ex-VAT); mid-cycle item changes without new sub may be missed.
- Cancellation reasons default to `unknown` until edited in Admin.
- Mode: stripe-history