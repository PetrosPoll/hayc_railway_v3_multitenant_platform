# Churn backfill report

Generated: 2026-10-09T23:19:00.312Z
dryRun: false
events_cutover_at: 2026-10-09T23:12:15.037Z

## Summary
- Customers processed: 7
- Backfill events cleared: 0
- launched_at updates: 4
- customer_stripe_accounts seeded: 7
- stripe_price_map seed writes: 17
- Unmapped Stripe price IDs: 0
- Approximations logged: 47
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

Cohort = status `active` at month start → not `active` at next month start (from event log). Months with subscription-row backfill are flagged **approximate** for gross MRR churn / NRR (do not trust those movement metrics).

| month | customers_start | churned_count | logo_churn_pct | mrr_movements |
|---|---|---|---|---|
| 2025-11 | 0 | 0 | n/a | ok / mixed |
| 2025-12 | 0 | 0 | n/a | ok / mixed |
| 2026-01 | 0 | 0 | n/a | ok / mixed |
| 2026-02 | 0 | 0 | n/a | ok / mixed |
| 2026-03 | 0 | 0 | n/a | ok / mixed |
| 2026-04 | 0 | 0 | n/a | ok / mixed |
| 2026-05 | 0 | 0 | n/a | ok / mixed |
| 2026-06 | 0 | 0 | n/a | **approximate** |
| 2026-07 | 3 | 0 | 0 | ok / mixed |
| 2026-08 | 3 | 0 | 0 | **approximate** |
| 2026-09 | 3 | 3 | 100 | **approximate** |
| 2026-10 | 3 | 0 | 0 | ok / mixed |

## Unmapped price IDs
(none)

## Approximations
- customer 37 sub #1: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #1: churn effective_at=2026-09-03T13:09:35.000Z from cancelledAt (historical; MRR churn approximate)
- customer 37 sub #2: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #2: churn effective_at=2026-09-03T13:09:35.000Z from cancelledAt (historical; MRR churn approximate)
- customer 37 sub #3: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #3: churn effective_at=2026-09-03T13:09:35.000Z from cancelledAt (historical; MRR churn approximate)
- customer 37 sub #17: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #18: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #19: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #20: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #21: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #23: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #24: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #22: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #25: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #26: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #27: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #28: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #29: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #32: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #30: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #31: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #33: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 37 sub #34: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 43 sub #10: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 43 sub #10: churn effective_at=2026-06-08T14:22:34.000Z from cancelledAt (historical; MRR churn approximate)
- customer 43 sub #11: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 43 sub #11: churn effective_at=2026-06-08T14:22:34.000Z from cancelledAt (historical; MRR churn approximate)
- customer 44 sub #12: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 44 sub #12: churn effective_at=2026-09-06T14:40:41.000Z from cancelledAt (historical; MRR churn approximate)
- customer 44 sub #13: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 44 sub #13: churn effective_at=2026-09-06T14:40:41.000Z from cancelledAt (historical; MRR churn approximate)
- customer 45 sub #15: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 45 sub #15: churn effective_at=2026-09-09T16:11:50.000Z from cancelledAt (historical; MRR churn approximate)
- customer 45 sub #16: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 45 sub #16: churn effective_at=2026-09-09T16:11:50.000Z from cancelledAt (historical; MRR churn approximate)
- customer 45 sub #14: reactivation at createdAt (subscription-row granularity; MRR movements approximate)
- customer 45 sub #14: churn effective_at=2026-09-09T16:11:50.000Z from cancelledAt (historical; MRR churn approximate)
- customer 47 sub #35: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 47 sub #36: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 47 sub #37: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 48 sub #39: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 48 sub #38: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 48 sub #40: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 49 sub #41: new at createdAt (subscription-row granularity; MRR movements approximate)
- customer 49 sub #42: expansion at createdAt (subscription-row granularity; MRR movements approximate)
- customer 49 sub #43: expansion at createdAt (subscription-row granularity; MRR movements approximate)

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
- Historical plan changes approximated at subscription-row granularity (not full invoice history).
- Historical cancellation reasons default to `unknown` unless local cancellation_reason indicated payment_failed.
- Historical immediate cancels use cancelledAt as churn effective_at.
- STOP: metrics service / Churn UI not built until this reconciliation is accepted.