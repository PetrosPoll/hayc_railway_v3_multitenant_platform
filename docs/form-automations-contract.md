# Form automations — site template contract

Platform feature: customers name forms in the content editor, then configure a custom visitor confirmation email per form in the website dashboard (**Automations**).

## Config shape (`sites/{siteId}/config/config.json`)

```json
{
  "forms": [
    {
      "id": "contact-a7k2",
      "name": "Contact form",
      "page": "/contact"
    }
  ]
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `id` | yes | Stable unique id. Suggested: slug from name + short random suffix (e.g. `contact-a7k2`). Never change after creation. |
| `name` | yes | Display label in the dashboard Automations list. |
| `page` | no | Optional path hint for editors. |

Merge by `id` when updating. Do not wipe unrelated `forms` entries.

## Content editor (edit mode)

When the customer names a form in edit mode:

1. Generate `id` if missing: `slugify(name) + "-" + random4`
2. Upsert into `config.forms`
3. Persist via the existing config save path (`HAYC_CONFIG_UPDATE` → parent PUT `/api/websites/:id/site-config`, or equivalent)

The form component on the live page must retain the assigned `id` (prop / data attribute) so submits can send it.

## Form submit

`POST {apiUrl}/public/contact` (same as today), with:

```json
{
  "siteId": "<siteId>",
  "formId": "contact-a7k2",
  "name": "...",
  "email": "...",
  "message": "...",
  "phone": "..."
}
```

- `formId` is optional for backwards compatibility.
- With `formId` + an enabled automation in the platform DB → custom visitor subject/body.
- Without automation → localized default confirmation (`websiteLanguage` en/gr).

Owner notification email is unchanged.

## Placeholders (subject + body)

`{{name}}`, `{{email}}`, `{{phone}}`, `{{message}}`, `{{siteLabel}}`

## Platform APIs (already implemented)

- `GET /api/websites/:id/forms` → `{ forms: SiteFormConfig[] }` from S3 config
- `GET /api/websites/:id/form-automations`
- `PUT /api/websites/:id/form-automations/:formId` → `{ enabled, visitorSubject, visitorBody }`
