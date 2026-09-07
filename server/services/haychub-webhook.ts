const LOG_PREFIX = "[HaycHub]";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

export interface HaycHubCustomerPaidPayload {
  haycCustomerId: string;
  name: string;
  email: string;
  businessName?: string;
  phone?: string;
  websiteUrl?: string;
  plan?: string;
  language?: string;
  paidAmountCents?: number;
  onboardingForm?: Record<string, unknown>;
}

export interface HaycHubDeliverDeps {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  env?: NodeJS.ProcessEnv;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attemptIndex: number): number {
  return 1000 * 2 ** attemptIndex;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function compactHaycHubPayload(
  payload: HaycHubCustomerPaidPayload,
): HaycHubCustomerPaidPayload | null {
  const haycCustomerId = payload.haycCustomerId?.trim();
  const name = payload.name?.trim();
  const email = payload.email?.trim();
  if (!haycCustomerId || !name || !email) {
    return null;
  }

  const body: HaycHubCustomerPaidPayload = {
    haycCustomerId,
    name,
    email,
  };

  if (isNonEmptyString(payload.businessName)) {
    body.businessName = payload.businessName.trim();
  }
  if (isNonEmptyString(payload.phone)) {
    body.phone = payload.phone.trim();
  }
  if (isNonEmptyString(payload.websiteUrl)) {
    body.websiteUrl = payload.websiteUrl.trim();
  }
  if (isNonEmptyString(payload.plan)) {
    body.plan = payload.plan.trim();
  }
  if (isNonEmptyString(payload.language)) {
    body.language = payload.language.trim();
  }
  if (
    typeof payload.paidAmountCents === "number" &&
    Number.isFinite(payload.paidAmountCents)
  ) {
    body.paidAmountCents = Math.round(payload.paidAmountCents);
  }
  if (
    payload.onboardingForm &&
    typeof payload.onboardingForm === "object" &&
    !Array.isArray(payload.onboardingForm)
  ) {
    body.onboardingForm = payload.onboardingForm;
  }

  return body;
}

export function serializeOnboardingForm(
  form: unknown,
): Record<string, unknown> | undefined {
  if (!form || typeof form !== "object") {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(form)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function websiteUrlFromOnboarding(input: {
  hasDomain?: string | null;
  existingDomain?: string | null;
  websiteLink?: string | null;
}): string | undefined {
  const raw =
    input.hasDomain === "yes" && isNonEmptyString(input.existingDomain)
      ? input.existingDomain.trim()
      : isNonEmptyString(input.websiteLink)
        ? input.websiteLink.trim()
        : "";
  if (!raw) {
    return undefined;
  }
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function isRetryableStatus(status: number): boolean {
  if (status === 400 || status === 401 || status === 503) {
    return false;
  }
  return status >= 500;
}

/**
 * Fire-and-forget Hub notify after onboarding form completion.
 * The HTTP handler must not await this.
 */
export function notifyHaycHubCustomerPaid(
  payload: HaycHubCustomerPaidPayload,
  deps?: HaycHubDeliverDeps,
): void {
  void deliverHaycHubCustomerPaid(payload, deps).catch((error) => {
    console.error(`${LOG_PREFIX} Unexpected error (request unaffected)`, {
      error: error instanceof Error ? error.message : error,
    });
  });
}

export async function deliverHaycHubCustomerPaid(
  payload: HaycHubCustomerPaidPayload,
  deps: HaycHubDeliverDeps = {},
): Promise<{ ok: boolean; status?: number }> {
  const env = deps.env ?? process.env;
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;

  const url = env.HAYCHUB_WEBHOOK_URL?.trim();
  const secret = env.HAYCHUB_WEBHOOK_SECRET?.trim();
  if (!url || !secret) {
    console.warn(
      `${LOG_PREFIX} HAYCHUB_WEBHOOK_URL or HAYCHUB_WEBHOOK_SECRET missing, skipping notification`,
    );
    return { ok: false };
  }

  const body = compactHaycHubPayload(payload);
  if (!body) {
    console.warn(
      `${LOG_PREFIX} Skipping notification: haycCustomerId, name, and email are required`,
      {
        haycCustomerId: payload.haycCustomerId,
        hasName: Boolean(payload.name),
        hasEmail: Boolean(payload.email),
      },
    );
    return { ok: false };
  }

  const jsonBody = JSON.stringify(body);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: jsonBody,
        signal: controller.signal,
      });

      if (response.status === 200 || response.status === 201) {
        let hubIds: { clientId?: unknown; projectId?: unknown; created?: unknown } =
          {};
        try {
          hubIds = (await response.json()) as typeof hubIds;
        } catch {
          // Body is optional
        }
        console.log(`${LOG_PREFIX} Customer-paid notification succeeded`, {
          haycCustomerId: body.haycCustomerId,
          status: response.status,
          clientId: hubIds.clientId,
          projectId: hubIds.projectId,
          created: hubIds.created,
          attempt: attempt + 1,
        });
        return { ok: true, status: response.status };
      }

      const retryable = isRetryableStatus(response.status);
      console.error(`${LOG_PREFIX} Customer-paid notification failed`, {
        haycCustomerId: body.haycCustomerId,
        status: response.status,
        attempt: attempt + 1,
        retryable,
      });

      if (!retryable) {
        return { ok: false, status: response.status };
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Customer-paid notification network error`, {
        haycCustomerId: body.haycCustomerId,
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(backoffMs(attempt));
    }
  }

  console.error(`${LOG_PREFIX} Customer-paid notification gave up after retries`, {
    haycCustomerId: body.haycCustomerId,
    attempts: MAX_ATTEMPTS,
  });
  return { ok: false };
}
