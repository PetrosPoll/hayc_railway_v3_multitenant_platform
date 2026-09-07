import { and, desc, eq } from "drizzle-orm";
import {
  getStartedSubmissions,
  onboardingFormResponses,
  subscriptions,
  transactions,
  users,
  websiteProgress,
} from "@shared/schema";
import { db } from "../db";
import {
  deliverHaycHubCustomerPaid,
  serializeOnboardingForm,
  websiteUrlFromOnboarding,
  type HaycHubCustomerPaidPayload,
} from "./haychub-webhook";

export type HaycHubWebsiteNotifyResult =
  | { ok: true; status: number; created?: unknown }
  | { ok: false; error: string; httpStatus: number };

export async function notifyHaycHubFromWebsiteOnboarding(
  websiteProgressId: number,
): Promise<HaycHubWebsiteNotifyResult> {
  if (
    !process.env.HAYCHUB_WEBHOOK_URL?.trim() ||
    !process.env.HAYCHUB_WEBHOOK_SECRET?.trim()
  ) {
    return {
      ok: false,
      httpStatus: 503,
      error: "HaycHub webhook is not configured",
    };
  }

  const website = await db
    .select()
    .from(websiteProgress)
    .where(eq(websiteProgress.id, websiteProgressId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!website) {
    return { ok: false, httpStatus: 404, error: "Website not found" };
  }

  const owner = await db
    .select()
    .from(users)
    .where(eq(users.id, website.userId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!owner) {
    return { ok: false, httpStatus: 404, error: "Website owner not found" };
  }

  const gsSubmission = await db
    .select()
    .from(getStartedSubmissions)
    .where(
      and(
        eq(getStartedSubmissions.websiteProgressId, websiteProgressId),
        eq(getStartedSubmissions.status, "completed"),
      ),
    )
    .orderBy(desc(getStartedSubmissions.updatedAt))
    .limit(1)
    .then((rows) => rows[0]);

  const oldForm = await db
    .select()
    .from(onboardingFormResponses)
    .where(
      and(
        eq(onboardingFormResponses.websiteProgressId, websiteProgressId),
        eq(onboardingFormResponses.status, "completed"),
      ),
    )
    .orderBy(desc(onboardingFormResponses.id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!gsSubmission && !oldForm) {
    return {
      ok: false,
      httpStatus: 400,
      error: "Onboarding form is not completed for this website",
    };
  }

  const planSub = await db
    .select({
      id: subscriptions.id,
      tier: subscriptions.tier,
      productId: subscriptions.productId,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.websiteProgressId, websiteProgressId),
        eq(subscriptions.productType, "plan"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  let paidAmountCents: number | undefined;
  if (planSub) {
    const paidRows = await db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.subscriptionId, planSub.id),
          eq(transactions.status, "paid"),
        ),
      );
    const total = paidRows.reduce((sum, row) => sum + (row.amount || 0), 0);
    if (total > 0) {
      paidAmountCents = total;
    }
  }

  const customDomain = website.customDomain?.trim();
  const websiteUrlFromDomain = customDomain
    ? /^https?:\/\//i.test(customDomain)
      ? customDomain
      : `https://${customDomain}`
    : undefined;

  const payload: HaycHubCustomerPaidPayload = gsSubmission
    ? {
        haycCustomerId: String(owner.id),
        name: gsSubmission.fullName || owner.username,
        email: gsSubmission.email || owner.email,
        businessName:
          gsSubmission.businessName || website.projectName || undefined,
        phone: gsSubmission.contactPhone || owner.phone || undefined,
        websiteUrl: websiteUrlFromDomain,
        plan: gsSubmission.selectedPlan || planSub?.tier || planSub?.productId || undefined,
        language:
          gsSubmission.websiteLanguage ||
          website.websiteLanguage ||
          owner.language ||
          undefined,
        paidAmountCents,
        onboardingForm: serializeOnboardingForm(gsSubmission),
      }
    : {
        haycCustomerId: String(owner.id),
        name: oldForm!.contactName || owner.username,
        email: oldForm!.accountEmail || oldForm!.contactEmail || owner.email,
        businessName: oldForm!.businessName || website.projectName || undefined,
        phone: oldForm!.contactPhone || owner.phone || undefined,
        websiteUrl:
          websiteUrlFromOnboarding({
            hasDomain: oldForm!.hasDomain,
            existingDomain: oldForm!.existingDomain,
            websiteLink: oldForm!.websiteLink,
          }) || websiteUrlFromDomain,
        plan: planSub?.tier || planSub?.productId || undefined,
        language:
          oldForm!.websiteLanguage ||
          website.websiteLanguage ||
          owner.language ||
          undefined,
        paidAmountCents,
        onboardingForm: serializeOnboardingForm(oldForm),
      };

  const result = await deliverHaycHubCustomerPaid(payload);
  if (result.ok && (result.status === 200 || result.status === 201)) {
    return { ok: true, status: result.status };
  }

  if (result.status === 400 || result.status === 401 || result.status === 503) {
    return {
      ok: false,
      httpStatus: result.status,
      error: `HaycHub rejected the request (${result.status})`,
    };
  }

  return {
    ok: false,
    httpStatus: 502,
    error: "HaycHub did not accept the notification",
  };
}
