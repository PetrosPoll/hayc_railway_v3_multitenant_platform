# HAYC Automations v2 — Exploration & Plan (Step 0)

> Generated from codebase exploration. **No code changes in this step.**  
> Await approval before Phase 0 implementation.

---

## 1. Current architecture (map)

### 1.1 Builder UI

| Piece | Path | Notes |
|-------|------|--------|
| Dashboard entry | `client/src/pages/website-dashboard.tsx` | Section `automations` when `website.siteId` is set |
| Visual builder | `client/src/components/automations/AutomationBuilder.tsx` | React Flow canvas, palette, edit panel, Ενεργό toggle, Save |
| Node components | `client/src/components/automations/nodes.tsx` | `TriggerNode`, `EmailNode`, `DelayNode` only |
| Orphan legacy UI | `client/src/components/form-automations-panel.tsx` | **Not mounted** anywhere; superseded by AutomationBuilder |

**Current graph vocabulary:** `trigger` \| `email` \| `delay`.  
**Save API:** `GET/POST/PUT/DELETE /api/websites/:id/automation-workflows` in `server/routes.ts`.

### 1.2 Workflow storage (DB)

Defined in `shared/schema.ts`, created in migrations `0023_*` (legacy) and `0025_*` (workflows/jobs).

| Table | Role | Key columns |
|-------|------|-------------|
| `website_automation_workflows` | Client workflows | `website_progress_id`, `name`, `enabled`, `trigger_form_id`, `graph` jsonb |
| `website_automation_jobs` | Delay resume jobs | `workflow_id`, `node_id`, `run_at`, `status`, `payload` jsonb, `error_message` |
| `website_email_templates` | Reusable visitor email templates | `name`, `subject`, `body`, `logo_url` |
| `website_form_automations` | **Legacy** per-form confirmation | `form_id`, `enabled`, `visitor_subject`, `visitor_body`, `logo_url` |

**Naming convention:** tables use `website_progress_id` (not `website_id`). Spec tables should follow this FK pattern.

**Graph type:** `AutomationGraph` / `AutomationJobPayload` in `shared/schema.ts`.

### 1.3 Workflow execution

| Piece | Path |
|-------|------|
| Engine | `server/lib/automation-engine.ts` |
| Entry | `startWorkflowForFormSubmit(...)` |
| Placeholders / legacy helpers | `server/lib/form-automations.ts` |
| Contract (sites) | `docs/form-automations-contract.md` |

**Flow today**

1. Form POST arrives (`/public/contact` or newsletter subscribe).
2. If `formId` present → `startWorkflowForFormSubmit`.
3. Loads enabled workflow for `(websiteProgressId, formId)`.
4. Walks graph from trigger: `email` sends then continues; `delay` writes a job and stops.
5. If no workflow → legacy `website_form_automations` (or platform default on contact).

**Owner notification** on contact is **always** sent outside the graph (hard-coded in `routes.ts`). It is not a workflow node today.

### 1.4 How Delay works today

- **Not** setTimeout-per-request, Bull, or pg-boss.
- Delay node → row in `website_automation_jobs` with `run_at = now + delay`, `status = pending`.
- `server/scheduler.ts` → `startCampaignScheduler` runs a **`setInterval` every 60s**.
- Each tick calls `processDueAutomationJobs()` (claims up to 50 due rows, resumes outgoing edges).

**Implication for Phase 0:** delays already survive restarts via Postgres, but claiming is optimistic (status flip), with **no retries/backoff**, **no run/step history**, and **no cancel_key**.

### 1.5 Email sending (SES)

| Piece | Path |
|-------|------|
| SES wrapper | `server/email-service.ts` (`EmailService.sendEmail`, `sendSystemEmail`) |
| Automation visitor emails | `automation-engine.ts` → template `public-contact-visitor-custom.html` |
| Templates dir | `server/email-templates/{en,gr}/` |

From address for automation visitor mail: `notifications@hayc.gr` (wrapped HTML).  
Newsletter campaigns use the same SES layer with newsletter config set.

### 1.6 Legacy per-form confirmation

- Table: `website_form_automations`.
- APIs: `GET/PUT /api/websites/:id/form-automations` still exist.
- Precedence: **visual workflow > legacy row > platform default** (contact only).
- Newsletter: no workflow and no legacy → **no** visitor email.

### 1.7 Newsletter campaign scheduler

| Piece | Path |
|-------|------|
| Scheduler | `server/scheduler.ts` — `checkAndSendScheduledCampaigns` |
| Started from | `routes.ts` (~`startCampaignScheduler(storage)`) |

Same 60s loop as automation delays. Spec ground rule: **do not change campaign creation/scheduling UI**. Phase 0 may move *sending jobs* onto the unified queue as `is_system` work while keeping behavior identical.

### 1.8 Website-progress owner reminders

| Piece | Path |
|-------|------|
| Logic | `sendWaitingStageReminders` in `server/routes.ts` (~23605+) |
| Timer | Separate `setInterval` in `routes.ts` (not `scheduler.ts`) |
| Trigger | Stages with `status = 'waiting'`, daily ~10:00 local, interval from stage settings |
| Template | `stage-waiting-reminder.html` |

Independent of the automation builder. Phase 0 can move onto the same queue as system jobs.

### 1.9 Form submission → backend (Cloudflare / sites)

| Endpoint | Path in `routes.ts` | Automations |
|----------|---------------------|-------------|
| `POST /public/contact` | ~25207+ | Owner email always; visitor via workflow → legacy → default |
| `POST /api/newsletter/subscribe` | ~24924+ | Workflow/legacy only for **new** contacts with `formId` |

Sites keep posting to these URLs (rate limit + honeypot `_hp`). Phase 0: **keep endpoints**, convert internally to `emitEvent({ type: 'form.submitted', ... })`.

Form catalog for the builder comes from S3 site config (`forms[]`), not from a DB field catalog:

| Piece | Path |
|-------|------|
| S3 config | `server/s3-config.ts` (`sites/{siteId}/config/config.json`) |
| Parse forms | `parseSiteForms` in `server/lib/form-automations.ts` |
| API | `GET /api/websites/:id/forms`, `PUT /api/websites/:id/site-config` |
| Editor | `client/src/components/content-editor.tsx` |

### 1.10 Booking module

| Piece | Path |
|-------|------|
| SSO into external app | `GET /api/booking/sso-token` in `routes.ts` |
| Flag | `websiteProgress.bookingEnabled` |

Booking emails live in the **external booking app**. Ground rule: **do not change booking emails**. Phase 2 only adds event emission (`booking.created` / `cancelled` / `completed`) from that boundary.

### 1.11 Contacts today

| Table | Role |
|-------|------|
| `contacts` | Primary list; newsletter subscribe writes here; tags via `contact_tags` |
| `newsletter_subscribers` | Legacy parallel list (still used by some campaign paths) |
| `website_contact_submissions` | Contact-form submission log (not a CRM contact) |

Phase 1 “internal contacts” should **extend/align** with `contacts` (unique per website + email) rather than invent a second CRM table if possible — see open questions.

### 1.12 Feature flags / queue libs

- **No** `automations_engine` flag today. Automations UI gated only by `siteId`.
- **No** pg-boss / graphile-worker / Bull in `package.json`.
- Job “infrastructure” = SQL tables + in-process `setInterval` pollers.

---

## 2. Spec → codebase mapping

| Spec item | Reuse | Replace / extend | New |
|-----------|-------|------------------|-----|
| Builder canvas / palette / save UX | `AutomationBuilder.tsx`, `nodes.tsx` | Extend palette sections, new node types, frequency, history tab | — |
| Workflow storage | `website_automation_workflows` | Add columns: `trigger_type`, `trigger_config`, `frequency`, `is_system`, `preset_key`, `version`; relax `trigger_form_id` for non-form triggers | Prefer **extend** over new `workflows` table |
| Graph `definition` | Existing `graph` jsonb | Expand node type union | — |
| Delay jobs | `website_automation_jobs` | Evolve into step execution **or** migrate to pg-boss and keep table as step log | `workflow_runs`, `workflow_steps`, `events` |
| Form submit path | `/public/contact`, newsletter subscribe | Wrap with `emitEvent('form.submitted')` | `POST /api/events`, `emitEvent()` |
| Visitor email node | `automation-engine` send path | Keep SES + placeholders | — |
| Legacy confirmations | `website_form_automations` | Migration → workflow rows; disable when flag = `v2` | — |
| Owner contact email | Hard-coded in contact route | Phase 1: optional `notify_owner` node; decide whether to stop always-send (open question) | — |
| Newsletter campaign schedule UI | Campaign wizard / dashboard | **Untouched** | System job only for send execution (optional in 0.4) |
| Waiting-stage reminders | `sendWaitingStageReminders` | Move schedule onto unified queue | System workflow / job |
| Form field catalog | `parseSiteForms` from S3 | Sync on site-config PUT | `form_fields` table |
| Feature flag | — | — | `automations_engine` on `website_progress` (or settings) |
| Contacts / tags / conditions | `contacts` + tags | Upsert on every event; tags in builder | Condition node, frequency, history |
| Booking events | SSO only | Emit events from booking boundary | Phase 2 triggers |
| SES open/click | Newsletter SES config set exists | — | SNS → `/api/ses-events`, `email_events` (Phase 2) |

---

## 3. Recommended queue choice: **pg-boss**

| Option | Pros | Cons |
|--------|------|------|
| **pg-boss** (recommended) | Spec-aligned; `startAfter` / `run_at` delays; retries; cancel; Postgres-native; small API | Needs a **direct** (non-pooled) DB connection for the worker — important on Neon |
| graphile-worker | Solid, job helpers | Heavier Graphile ecosystem; same Neon LISTEN concerns |
| Extend current `website_automation_jobs` only | Zero new dep; already used | Must hand-roll leases, retries, backoff, cancel, multi-worker safety |

**Plan:** introduce **pg-boss** for Phase 0 execution (one worker started from `server/index.ts` / `scheduler.ts`), using `DATABASE_URL` direct connection (or `DATABASE_URL_UNPOOLED` if present). Keep/repurpose SQL tables for **runs/steps/events** as the source of truth for History UI; pg-boss jobs reference `workflow_steps.id`.

Fallback if Neon constraints bite: implement `FOR UPDATE SKIP LOCKED` claimer on `workflow_steps` with the same semantics (still no Redis).

---

## 4. Phase 0 design sketch (for approval — not implementing yet)

### 4.1 Flag

```text
website_progress.automations_engine: 'legacy' | 'v2'  (default 'legacy')
```

- `legacy`: today’s `startWorkflowForFormSubmit` + legacy fallback.
- `v2`: form handlers only `emitEvent`; engine runs workflows; legacy send skipped when a workflow exists **or** after migration of legacy rows.

### 4.2 Tables (adapt names)

Prefer:

- `automation_events` (avoid clash with analytics `analytics_events`)
- Extend `website_automation_workflows` (not a parallel `workflows` table)
- `website_automation_runs` + `website_automation_steps`
- `website_form_fields` for schema sync

All keyed by `website_progress_id`.

### 4.3 Event intake

- Internal: `emitEvent({ websiteProgressId, type, payload, dedupeKey? })`
- External: `POST /api/events` (authenticated via site API key / signed site id — **open question** on exact auth)
- Form routes: build `form.submitted` with `form_id` + fields + `dedupe_key` (e.g. hash of website + form + email + minute bucket, or client idempotency key)

### 4.4 Unify legacy

Migration script:

1. For each `website_form_automations` row without an enabled workflow for that `form_id`, insert a workflow: trigger → email node (subject/body/logo from legacy).
2. Mark migrated; under `v2`, skip legacy send path.

### 4.5 System jobs (hidden)

- Newsletter **send** of already-scheduled campaigns → queue job (UI unchanged).
- Waiting-stage owner reminders → scheduled system job (UI unchanged).

### 4.6 Form schema sync

On successful `PUT /api/websites/:id/site-config` (and optionally on GET forms refresh): upsert `website_form_fields` from `forms[].fields` with stable `key`.

---

## 5. Risks

1. **Dual engines during rollout** — bugs if flag flipped mid-run; need clear “in-flight legacy jobs still drain”.
2. **Owner email duplication** — contact route always notifies owner; adding `notify_owner` node can double-email unless we change the hard-coded path under `v2`.
3. **Neon + pg-boss** — pooled Prisma/Neon URLs break LISTEN; must document unpooled URL.
4. **Idempotency key design** — too coarse drops real submits; too fine allows double-clicks through.
5. **`contacts` table semantics** — already used for newsletter; Phase 1 upsert must not break campaign audiences / tags.
6. **Large Unlayer/HTML emails vs automation templates** — automation emails are plain/custom HTML today; keep separate from newsletter Unlayer templates.
7. **Multi-instance Railway** — today every instance runs `setInterval` (possible double-send). A real queue with leases fixes this; flag as must-have for Phase 0.
8. **Booking app ownership** — emitting events requires a small change in the booking service or a webhook into HAYC; not in this monorepo alone.

---

## 6. Open questions (need decisions before / during Phase 0)

1. **Flag default:** stay `legacy` until per-tenant opt-in, or gradual auto-migrate?
2. **Owner notification under v2:** keep always-on outside workflows, or only via `notify_owner` node (breaking change for sites that rely on the hard-coded email)?
3. **`POST /api/events` auth:** reuse analytics API key? new `website_automation_keys`? Cloudflare Worker shared secret?
4. **Contacts model:** extend existing `contacts` vs new `automation_contacts`? Spec unique `(website_id, email)` matches extending `contacts` if we add missing columns (`dates`, `consent_marketing`, `last_booking_at`, …).
5. **Newsletter scheduler move in 0.4:** do in Phase 0 or defer until form engine is stable? (Recommend **defer system moves** until form.v2 is proven.)
6. **Tenant id naming:** confirm all new APIs use `websiteProgressId` in JSON for consistency with the rest of the platform (map from spec’s `website_id`).
7. **Form field shape in config:** do all live templates already expose stable `key`s on fields, or do we need a one-time backfill from labels?

---

## 6b. Recommended answers (for discussion)

| # | Proposal |
|---|----------|
| 1 | Default `legacy`; admin/ops flips `v2` per website after migration dry-run |
| 2 | Under `v2`, keep always-on owner email **until** Phase 1 ships `notify_owner`, then make it configurable (default on for migrated contact workflows) |
| 3 | Prefer extending existing public form auth (same origin + honeypot) for form→event; reserve `/api/events` for trusted backend + booking with HMAC/site key |
| 4 | Extend `contacts` |
| 5 | Defer newsletter + waiting-reminder queue migration to end of Phase 0 or a 0.4b after form parity |
| 6 | `websiteProgressId` in code/API; docs can say website |
| 7 | Audit on publish; if `key` missing, slugify label once and persist |

---

## 7. Suggested implementation order (after approval)

1. Schema + flag + `emitEvent` + `automation_events` (dedupe).
2. Runs/steps + pg-boss worker; port form workflows to v2 engine behind flag.
3. Legacy → workflow migration; disable legacy send on `v2`.
4. Form fields sync on site-config PUT.
5. Parity tests (idempotency, retry, delay across restart, double submit).
6. Only then: system jobs (newsletter send / waiting reminders).
7. Phase 1 UI/actions…

---

## 8. Acceptance criteria checklist (Phase 0 — from spec)

- [ ] Flag on → every form submission runs through new engine; emails identical to today  
- [ ] Same `dedupe_key` → one run  
- [ ] Throwing step retried then `failed` with error stored  
- [ ] Multi-day delay survives server restart  
- [ ] Newsletter campaigns and progress reminders still send as before  

---

## 9. Stop

**Step 0 complete.** No application code was changed in this step (only this plan file).

Please review §5 risks, §6 open questions, and §6b proposals, then approve Phase 0 (or adjust answers) before any implementation.

---

## 10. Phase 0 implementation status (approved)

**Shipped (2026-10-18):**

| Item | Status |
|------|--------|
| `website_progress.automations_engine` (`legacy`\|`v2`) | Done — default `legacy` |
| `automation_events` + dedupe | Done |
| Extended `website_automation_workflows` | Done |
| `website_automation_runs` / `website_automation_steps` | Done |
| `website_form_fields` + sync on site-config PUT | Done |
| `emitEvent` + form route wiring | Done |
| Step worker (retries, backoff, delay `run_at`) | Done — Postgres claim in scheduler (Neon-friendly; not pg-boss) |
| Legacy → workflow migration | Done — on flip to `v2` + `POST .../automations/migrate-legacy` |
| `POST /api/events`, cancel, engine patch | Done |
| Newsletter / waiting-reminder on same queue | **Deferred** (0.4b) — still use existing schedulers; behavior unchanged |

**Enable v2 for a website:** `PATCH /api/websites/:id/automations-engine` with `{ "automationsEngine": "v2" }` (auto-migrates legacy confirmations).

---

## 11. Phase 1 implementation status

**Shipped (2026-10-19):**

| Item | Status |
|------|--------|
| Contact upsert on every `form.submitted` (extend `contacts`: phone, source, dates, consent_marketing) | Done |
| Actions: `notify_owner`, `owner_reminder`, `add_tag`, `remove_tag` | Done |
| Condition node `condition` (Yes/No handles; form field / tag / day / time) | Done |
| Frequency: `every_time` \| `once_per_contact` \| `once_per_contact_per_24h` | Done |
| History tab (last 100 runs + steps) | Done |
| Presets gallery + `from-preset` API | Done |
| Skip hard-coded owner email when workflow has `notify_owner` (v2 only) | Done |
| Legacy migrate appends `notify_owner` | Done |

**Manual test:** enable v2 → Start from template “Reply & notify” → submit form → visitor + owner emails; History tab shows run; frequency “once per contact” blocks second run.
