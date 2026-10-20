# Cursor prompt — wire Hayc booking app → automation events

Paste this into the Cursor agent that works on the **booking system** repo.

---

## Goal

Whenever a booking is **created**, **cancelled**, or **completed** on a tenant site, notify the Hayc multitenant platform so Automations v2 can run workflows (`booking.created` / `booking.cancelled` / `booking.completed`).

Do **not** change the existing booking confirmation emails. This is an additional outbound notify only.

## Platform API (already live)

`POST {HAYC_PLATFORM_BASE_URL}/api/websites/{websiteProgressId}/booking-events`

**Auth (one of):**

1. Header `x-booking-secret: {BOOKING_EVENTS_SECRET}` (shared secret with platform Doppler/env), or
2. Logged-in Hayc session cookie (dashboard test only — prefer secret for server-to-server).

**Body (JSON):**

```json
{
  "type": "booking.created" | "booking.cancelled" | "booking.completed",
  "email": "customer@example.com",
  "name": "Optional name",
  "phone": "Optional phone",
  "service": "Optional service label",
  "start_at": "ISO-8601 optional",
  "end_at": "ISO-8601 optional",
  "booking_id": "stable id from booking DB (required for cancel linkage)"
}
```

**Responses:**

- `200` — `{ eventId, deduped, runIds }` (or `{ cancelledSteps }` for cancel — see note below)
- `409` — website not on automations v2 (platform should now be all-v2; still handle gracefully)
- `401/403` — bad secret / no access
- `400` — validation error

## Mapping rules

| Booking domain event | `type` to send |
|----------------------|----------------|
| New booking confirmed / created | `booking.created` |
| Booking cancelled by customer or admin | `booking.cancelled` |
| Appointment finished / marked completed | `booking.completed` |

Always send:

- `email` of the guest (required)
- `booking_id` as a stable unique id for that booking (same string on create and cancel)
- `websiteProgressId` from tenant mapping (how this booking site maps to Hayc `website_progress.id`)

## Env vars (booking app)

```
HAYC_PLATFORM_BASE_URL=https://…   # platform origin, no trailing slash
BOOKING_EVENTS_SECRET=…            # must match platform BOOKING_EVENTS_SECRET
```

## Implementation sketch

1. Add a small client helper, e.g. `notifyHaycBookingEvent({ websiteProgressId, type, … })`.
2. Call it **after** the booking DB write succeeds (fire-and-forget with logging; do not fail the booking if notify fails).
3. On create → `booking.created`
4. On cancel → `booking.cancelled` (same `booking_id` as create)
5. On complete → `booking.completed` (include `end_at` when available — used for `lastBookingAt` / schedule offsets)
6. Retries: optional 1–2 retries on 5xx; log 4xx without retry spam.
7. Unit/integration test with mocked fetch.

## Important platform note (cancel)

Today the platform cancel path primarily **cancels in-flight automation runs** keyed by `booking:{websiteId}:{booking_id}`. Emitting cancel is still required so future “on cancel” workflows and run-cancel both work. Send the event with `booking_id` every time.

## Acceptance checklist

- [ ] Create booking → platform receives `booking.created` with correct `websiteProgressId` + email + `booking_id`
- [ ] Cancel same booking → `booking.cancelled` with same `booking_id`
- [ ] Complete booking → `booking.completed` with `end_at` when known
- [ ] Missing/wrong secret → no crash in booking; error logged
- [ ] Existing guest/owner booking emails unchanged

## Out of scope

- Building automation workflows in the booking UI
- Changing Hayc platform routes (already shipped)
