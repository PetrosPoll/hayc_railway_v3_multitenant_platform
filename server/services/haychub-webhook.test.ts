import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compactHaycHubPayload,
  deliverHaycHubCustomerPaid,
  serializeOnboardingForm,
  websiteUrlFromOnboarding,
} from "./haychub-webhook";

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const payload = {
  haycCustomerId: "123",
  name: "Μαρία Παπαδοπούλου",
  email: "maria@example.com",
  businessName: "Floral Studio",
  phone: "+30 69...",
  plan: "pro",
  language: "gr",
  paidAmountCents: 49000,
};

describe("compactHaycHubPayload", () => {
  it("drops empty optional fields", () => {
    expect(
      compactHaycHubPayload({
        haycCustomerId: "123",
        name: "Maria",
        email: "maria@example.com",
        businessName: "  ",
        phone: "",
        websiteUrl: undefined,
      }),
    ).toEqual({
      haycCustomerId: "123",
      name: "Maria",
      email: "maria@example.com",
    });
  });

  it("keeps the full onboarding form snapshot", () => {
    const onboardingForm = { businessName: "Floral Studio", services: "bouquets" };
    expect(
      compactHaycHubPayload({
        haycCustomerId: "123",
        name: "Maria",
        email: "maria@example.com",
        onboardingForm,
      }),
    ).toEqual({
      haycCustomerId: "123",
      name: "Maria",
      email: "maria@example.com",
      onboardingForm,
    });
  });

  it("returns null without required fields", () => {
    expect(
      compactHaycHubPayload({
        haycCustomerId: "123",
        name: "",
        email: "maria@example.com",
      }),
    ).toBeNull();
  });
});

describe("serializeOnboardingForm", () => {
  it("serializes dates", () => {
    expect(
      serializeOnboardingForm({
        businessName: "Floral Studio",
        createdAt: new Date("2026-09-07T00:00:00.000Z"),
      }),
    ).toEqual({
      businessName: "Floral Studio",
      createdAt: "2026-09-07T00:00:00.000Z",
    });
  });
});

describe("websiteUrlFromOnboarding", () => {
  it("uses existing domain when the customer already has one", () => {
    expect(
      websiteUrlFromOnboarding({
        hasDomain: "yes",
        existingDomain: "floral.gr",
      }),
    ).toBe("https://floral.gr");
  });

  it("omits unknown urls", () => {
    expect(websiteUrlFromOnboarding({ hasDomain: "no" })).toBeUndefined();
  });
});

describe("deliverHaycHubCustomerPaid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const env = {
    HAYCHUB_WEBHOOK_URL: "https://hub.example/api/integrations/hayc/customer-paid",
    HAYCHUB_WEBHOOK_SECRET: "hub-secret",
  };

  it("skips with a warning when env vars are missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFn = vi.fn();
    const result = await deliverHaycHubCustomerPaid(payload, {
      fetchFn,
      env: {},
    });
    expect(result).toEqual({ ok: false });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("POSTs with bearer auth and succeeds on 201", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(201, { clientId: "c1", projectId: "p1", created: true }),
    );
    const result = await deliverHaycHubCustomerPaid(payload, { fetchFn, env });
    expect(result).toEqual({ ok: true, status: 201 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(env.HAYCHUB_WEBHOOK_URL);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer hub-secret");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it("treats 200 as already-existed success", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(200, { clientId: "c1", projectId: "p1", created: false }),
    );
    const result = await deliverHaycHubCustomerPaid(payload, { fetchFn, env });
    expect(result).toEqual({ ok: true, status: 200 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("does not retry 400 or 401", async () => {
    const sleep = vi.fn();
    for (const status of [400, 401]) {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(status));
      const result = await deliverHaycHubCustomerPaid(payload, {
        fetchFn,
        sleep,
        env,
      });
      expect(result).toEqual({ ok: false, status });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }
  });

  it("does not retry 503", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(503));
    const sleep = vi.fn();
    const result = await deliverHaycHubCustomerPaid(payload, {
      fetchFn,
      sleep,
      env,
    });
    expect(result).toEqual({ ok: false, status: 503 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries 5xx with exponential backoff then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500))
      .mockResolvedValueOnce(jsonResponse(201, { created: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await deliverHaycHubCustomerPaid(payload, {
      fetchFn,
      sleep,
      env,
    });
    expect(result).toEqual({ ok: true, status: 201 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("retries network errors up to 3 attempts", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deliverHaycHubCustomerPaid(payload, {
      fetchFn,
      sleep,
      env,
    });
    expect(result).toEqual({ ok: false });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });
});
