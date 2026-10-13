# Payment statuses (Calendar v2)

Team reference: what each status means, UI treatment, automatic vs admin actions.

**VAT:** Amounts are treated as **συμπ. ΦΠΑ** (`vat_included = true`).

## Status table

| Status | Origin | Meaning | Card group | Automatic | Admin |
|--------|--------|---------|------------|-----------|-------|
| `upcoming` | both | Future charge, not yet due | Αναμενόμενα (blue) | Materialized for next 90 days; aging moves custom to `pending` on due date | Edit series (future rows); Αναβολή (custom) |
| `pending` | custom | Due today / awaiting confirmation | Αναμενόμενα | Nightly aging from `upcoming` | Πληρώθηκε / Μερική / Write off |
| `grace` | custom | Past due within `graceDays` (default 7) | Εκκρεμούν / Overdue (amber) | Nightly aging | Πληρώθηκε / Write off / Αναβολή |
| `action_required` | stripe | SCA / 3DS required | Εκκρεμούν / Overdue | Webhook `invoice.payment_action_required` | Send payment link; Επανάληψη χρέωσης |
| `retrying` | stripe | Failed; Stripe will retry | Εκκρεμούν / Overdue | Webhook `invoice.payment_failed` + `next_payment_attempt` | Send link; Επανάληψη χρέωσης |
| `delinquent` | both | Stripe: no more retries. Custom: past grace | Εκκρεμούν / Overdue | Webhook / nightly aging | Stripe: pay / mark uncollectible. Custom: settle / write off |
| `disputed` | stripe | Chargeback open | Εκκρεμούν / Overdue | `charge.dispute.created` | Monitor; Stripe Dashboard |
| `settled` | both | Paid in full | Εισπράχθηκαν (green) | Stripe: `invoice.payment_succeeded`. Custom: admin settle | Unsettle (custom) |
| `partially_paid` | custom | Partial settlement | Εισπράχθηκαν (paid) + Εκκρεμούν (rest) | — | Add partial / settle remainder |
| `refunded` / `partially_refunded` | stripe | Refund issued | Net in Εισπράχθηκαν only | `charge.refunded` / dispute lost | — |
| `written_off` | both | Uncollectible / admin write-off | Ακυρωμένα (rose) | Stripe: `invoice.marked_uncollectible` **also auto-cancels the Stripe subscription** | Custom write-off |
| `will_not_renew` | stripe | `cancel_at_period_end`; **this** charge still due | Αναμενόμενα (grey label) | `customer.subscription.updated` | Informational |
| `paused` | stripe | `pause_collection` | Not counted | pause/resume webhooks | — |
| `stopped` | both | Sub canceled / voided / series stopped | Ακυρωμένα | Sub deleted, orphan sweep, custom stop | — |

## Matching active ↔ upcoming

- Upcoming Stripe rows are materialized only for local `active` / `trialing` / `past_due` (and schedules).
- On cancel (local or Stripe) / reconcile orphan sweep, open obligations → `stopped` so they never stay in Αναμενόμενα.
- `cancel_at_period_end` → `will_not_renew` (still counted in Αναμενόμενα until the period charge settles or the sub is fully deleted).

## Risk flags (not statuses)

| Flag | Meaning |
|------|---------|
| `customer_past_due` | Customer subscription is past_due/unpaid |
| `card_expiring` | Default card expires before due date |

Flagged **Αναμενόμενα** rows count in “σε κίνδυνο”.

## Totals (server)

- **Εισπράχθηκαν** = Σ (amount_paid − amount_refunded) for collected statuses  
- **Αναμενόμενα** = Σ amount_due of `upcoming` + `pending` + `will_not_renew`  
- **Εκκρεμούν (Overdue)** = outstanding of grace/action_required/retrying/delinquent/disputed + unpaid part of `partially_paid`  
- **Ακυρωμένα** = amount_due of `stopped` + `written_off` (not in Σύνολο μήνα)  
- **Σύνολο μήνα** = Εισπράχθηκαν + Αναμενόμενα + Εκκρεμούν  

## Stripe writes allowed from calendar

Only explicit admin actions:

1. `invoices.pay` (Επανάληψη χρέωσης)  
2. `invoices.markUncollectible` (triggers existing auto-cancel — confirm dialog warns)  
3. Send payment link (read hosted URL; email only)

## History

Every status change is logged in `payment_obligation_history` (`source`: webhook | reconcile | admin | system | sync).
