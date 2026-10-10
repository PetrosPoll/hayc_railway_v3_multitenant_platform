# Churn backfill report

Generated: 2026-10-10T01:09:52.489Z
dryRun: false
events_cutover_at: 2026-10-10T00:52:47.539Z

## Summary
- Customers processed: 64
- Backfill events cleared: 0
- launched_at updates: 44
- customer_stripe_accounts seeded: 64
- stripe_price_map seed writes: 19
- Unmapped Stripe price IDs: 22
- Approximations logged: 81
- Active customers (live Stripe, ≥1 core sub): 11
- Total MRR ex-VAT (cents): 68883
- ARPA ex-VAT (cents): 6262 (€62.62)

## ARPA (ex VAT)

| metric | value |
|---|---|
| active_customers | 11 |
| mrr_cents_ex_vat | 68883 |
| arpa_cents_ex_vat | 6262 |

## Logo churn (last 12 months) — sanity table

Mode: **stripe-history**. Cohort = ≥1 core Stripe sub covering month start → none at next month start.

| month | customers_start | churned_count | logo_churn_pct | mrr_movements |
|---|---|---|---|---|
| 2025-11 | 24 | 0 | 0 | ok / mixed |
| 2025-12 | 25 | 0 | 0 | ok / mixed |
| 2026-01 | 28 | 0 | 0 | ok / mixed |
| 2026-02 | 37 | 0 | 0 | ok / mixed |
| 2026-03 | 40 | 0 | 0 | ok / mixed |
| 2026-04 | 42 | 1 | 2.38 | ok / mixed |
| 2026-05 | 41 | 3 | 7.32 | ok / mixed |
| 2026-06 | 38 | 3 | 7.89 | ok / mixed |
| 2026-07 | 39 | 2 | 5.13 | ok / mixed |
| 2026-08 | 40 | 4 | 10 | ok / mixed |
| 2026-09 | 38 | 1 | 2.63 | ok / mixed |
| 2026-10 | 41 | 1 | 2.44 | ok / mixed |

## Unmapped price IDs
- `price_1SP6GbB3lUTVGKGUJPMv2y0K`
- `price_1SCiNZB3lUTVGKGUrT9v1Ea9`
- `price_1SP67bB3lUTVGKGUDmqCaJGs`
- `price_1SP6MDB3lUTVGKGUMOM4MU1C`
- `price_1Sji8kB3lUTVGKGUeGDNZYTW`
- `price_1SiU6bB3lUTVGKGURAJeTdV9`
- `price_1Sji9dB3lUTVGKGUGSlJljr7`
- `price_1SRdMfB3lUTVGKGUbajeBHxA`
- `plan_SBhoY5AafUTkgu`
- `plan_RaRkZGzGAl1xEc`
- `price_1SP5xBB3lUTVGKGUUN9nVqZW`
- `plan_RXp5qv23T78DqS`
- `price_1SChXrB3lUTVGKGUWrPW6JGG`
- `price_1SCiPwB3lUTVGKGUQfxJ6JJL`
- `plan_SDxg2qdEcE0tsu`
- `plan_S1d4F3P8mltkBE`
- `plan_RXlnisEGfud25Z`
- `plan_RVrWzRcmrdZ4Pt`
- `plan_RiG25PSpTl4R9v`
- `plan_RbNFAuljNTNqS6`
- `plan_RcUy55xH7LQrYy`
- `price_1U3PhXB3lUTVGKGU4Qkkw13O`

## Approximations
- customer 38: no Stripe subs left; used local plan rows for logo history
- customer 38: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 39: no Stripe subs left; used local plan rows for logo history
- customer 40: no Stripe subs left; used local plan rows for logo history
- customer 41: no Stripe subs left; used local plan rows for logo history
- customer 50: no Stripe subs left; used local plan rows for logo history
- customer 50: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 51: no Stripe subs left; used local plan rows for logo history
- customer 51: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 47: no Stripe subs left; used local plan rows for logo history
- customer 3: no Stripe subs left; used local plan rows for logo history
- customer 3: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 8: no Stripe subs left; used local plan rows for logo history
- customer 8: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 5: no Stripe subs left; used local plan rows for logo history
- customer 5: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 10: no Stripe subs left; used local plan rows for logo history
- customer 7: no Stripe subs left; used local plan rows for logo history
- customer 7: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 6: no Stripe subs left; used local plan rows for logo history
- customer 6: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 12: no Stripe subs left; used local plan rows for logo history
- customer 4: no Stripe subs left; used local plan rows for logo history
- customer 4: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 46: no Stripe subs left; used local plan rows for logo history
- customer 46: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 42: no Stripe subs left; used local plan rows for logo history
- customer 42: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 48: no Stripe subs left; used local plan rows for logo history
- customer 48: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 11: no Stripe subs left; used local plan rows for logo history
- customer 11: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 9: no Stripe subs left; used local plan rows for logo history
- customer 9: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 13: no Stripe subs left; used local plan rows for logo history
- customer 13: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 37: no Stripe subs left; used local plan rows for logo history
- customer 27: no Stripe subs left; used local plan rows for logo history
- customer 27: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 31: no Stripe subs left; used local plan rows for logo history
- customer 31: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 29: no Stripe subs left; used local plan rows for logo history
- customer 29: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 32: no Stripe subs left; used local plan rows for logo history
- customer 32: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 30: no Stripe subs left; used local plan rows for logo history
- customer 23: no Stripe subs left; used local plan rows for logo history
- customer 25: no Stripe subs left; used local plan rows for logo history
- customer 25: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 20: no Stripe subs left; used local plan rows for logo history
- customer 20: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 19: no Stripe subs left; used local plan rows for logo history
- customer 43: no Stripe subs left; used local plan rows for logo history
- customer 24: no Stripe subs left; used local plan rows for logo history
- customer 24: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 21: no Stripe subs left; used local plan rows for logo history
- customer 21: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 14: no Stripe subs left; used local plan rows for logo history
- customer 14: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 16: no Stripe subs left; used local plan rows for logo history
- customer 16: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 17: no Stripe subs left; used local plan rows for logo history
- customer 22: no Stripe subs left; used local plan rows for logo history
- customer 28: no Stripe subs left; used local plan rows for logo history
- customer 28: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 15: no Stripe subs left; used local plan rows for logo history
- customer 15: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 26: no Stripe subs left; used local plan rows for logo history
- customer 26: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 44: no Stripe subs left; used local plan rows for logo history
- customer 33: no Stripe subs left; used local plan rows for logo history
- customer 33: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 53: no Stripe subs left; used local plan rows for logo history
- customer 45: no Stripe subs left; used local plan rows for logo history
- customer 18: no Stripe subs left; used local plan rows for logo history
- customer 55: no Stripe subs left; used local plan rows for logo history
- customer 52: no Stripe subs left; used local plan rows for logo history
- customer 56: no Stripe subs left; used local plan rows for logo history
- customer 56: period-end cancel after cutover — left active until Stripe deleted webhook
- customer 69: no Stripe subs left; used local plan rows for logo history
- customer 69: period-end cancel after cutover — left active until Stripe deleted webhook

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
      "tableID": 16695,
      "columnID": 10,
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
| 38 | dmlapartment@gmail.com | 0 | 0 |
| 39 | info@primeluxtransfers.com | 0 | 0 |
| 40 | info@i-paidi.gr | 0 | 0 |
| 41 | info@italingua.gr | 0 | 0 |
| 50 | dionpaxinos@yahoo.gr | 0 | 0 |
| 51 | ns.holistic.coach@gmail.com | 0 | 0 |
| 47 | lvic@digitalsima.gr | 0 | 0 |
| 3 | agapiapostolopoulou@gmail.com | 0 | 0 |
| 8 | anastasiamparmpouta31@gmail.com | 0 | 0 |
| 5 | a.patrikounakos@hotmail.com | 0 | 0 |
| 10 | xrisa.xatzimarinaki@gmail.com | 0 | 0 |
| 7 | katsarostony@gmail.com | 0 | 0 |
| 6 | A.kokonapsychologist@hotmail.com | 0 | 0 |
| 12 | dg4747dg@gmail.com | 0 | 0 |
| 4 | www.aggeloskaravidas@gmail.com | 0 | 0 |
| 46 | achilleasfekkas@gmail.com | 0 | 0 |
| 42 | christopouloueleni1@gmail.com | 0 | 0 |
| 48 | milioutaniafineart@gmail.com | 0 | 0 |
| 11 | ecowavetech@gmail.com | 0 | 0 |
| 9 | pinzer.carina@gmail.com | 0 | 0 |
| 13 | dnasikas@gmail.com | 0 | 0 |
| 37 | gkelykal5@gmail.com | 0 | 0 |
| 27 | nikosdellios.nd@gmail.com | 0 | 0 |
| 31 | yourholidays2023@gmail.com | 0 | 0 |
| 34 | yannisravanopoulos@gmail.com | 0 | 0 |
| 29 | petsavas@gmail.com | 0 | 0 |
| 32 | zouvanesa@gmail.com | 0 | 0 |
| 30 | nrai197869@gmail.com | 0 | 0 |
| 23 | konstantinoskechagias87@gmail.com | 0 | 0 |
| 25 | michaelkostakis@yahoo.gr | 0 | 0 |
| 20 | gortynalive@gmail.com | 0 | 0 |
| 19 | gianni.gerzelis@gmail.com | 0 | 0 |
| 43 | u2371865430@gmail.com | 0 | 0 |
| 24 | p.k7xas@gmail.com | 0 | 0 |
| 21 | s.karefyllakis@gmail.com | 0 | 0 |
| 14 | dragicaidoski10@gmail.com | 0 | 0 |
| 16 | georgiosgalanopoulos@yahoo.com | 0 | 0 |
| 49 | fot_karvelis@yahoo.gr | 4900 | 1 |
| 17 | gvasilarakos@yahoo.com | 0 | 0 |
| 22 | prifkon@gmail.com | 0 | 0 |
| 28 | proiospan@gmail.com | 0 | 0 |
| 15 | mamacoachgreece@gmail.com | 0 | 0 |
| 26 | diakonis247@gmail.com | 0 | 0 |
| 44 | gkselfchallenge@gmail.com | 0 | 0 |
| 33 | pdeliyianni@gmail.com | 0 | 0 |
| 53 | Vasilakoslef@gmail.com | 0 | 0 |
| 54 | dtzamouranis@uniwa.gr | 0 | 0 |
| 57 | info@ios-transfer.com | 0 | 0 |
| 45 | dimitrischaralampidis42@gmail.com | 0 | 0 |
| 18 | svouras007@yahoo.gr | 0 | 0 |
| 55 | christosfilippousis@gmail.com | 0 | 0 |
| 52 | dimitrioskontogiannis@gmail.com | 0 | 0 |
| 58 | sandrakyr2024@gmail.com | 4900 | 1 |
| 59 | georkera@gmail.com | 4900 | 1 |
| 60 | rikosaggelos@gmail.com | 14700 | 3 |
| 61 | thanosgolf@hotmail.com | 6400 | 1 |
| 62 | kavalarealestate@hotmail.com | 4900 | 1 |
| 64 | vitabairaktaris@gmail.com | 6400 | 1 |
| 65 | ioanna.prudon@viaferriesethotels.com | 4900 | 1 |
| 56 | tsoureka@gmail.com | 0 | 0 |
| 67 | info@deselio.gr | 4083 | 1 |
| 68 | info@eskapex.com | 6400 | 1 |
| 69 | kalidoni834@gmail.com | 0 | 0 |
| 70 | papalexistavroula@gmail.com | 6400 | 1 |

## Notes
- Logo timeline rebuilt from Stripe subscriptions (core coverage intervals).
- MRR from Stripe price items at each sub (ex-VAT); mid-cycle item changes without new sub may be missed.
- Cancellation reasons default to `unknown` until edited in Admin.
- Mode: stripe-history