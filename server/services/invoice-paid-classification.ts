export type InvoicePaidClassification =
  | { kind: "new" }
  | { kind: "reactivation" }
  | { kind: "payment_recovered" }
  | { kind: "expansion" }
  | { kind: "contraction" }
  | { kind: "none" };

export type ClassifyInvoicePaidInput = {
  billingReason: string | null | undefined;
  /** True if HAYC customer has any prior churn event. */
  hasPriorChurn: boolean;
  /** True if the subscription was past_due before this payment recovered. */
  wasPastDue: boolean;
  mrrAfterCents: number;
  mrrBeforeCents: number;
};

/**
 * Classify invoice.paid / invoice.payment_succeeded for the churn event log.
 * Never emits `new` on a renewal (`subscription_cycle`).
 */
export function classifyInvoicePaidEvent(
  input: ClassifyInvoicePaidInput,
): InvoicePaidClassification {
  const reason = input.billingReason ?? null;

  if (reason === "subscription_create") {
    return input.hasPriorChurn
      ? { kind: "reactivation" }
      : { kind: "new" };
  }

  if (reason === "subscription_cycle") {
    if (input.wasPastDue) return { kind: "payment_recovered" };
    return { kind: "none" };
  }

  if (reason === "subscription_update") {
    if (input.mrrAfterCents === input.mrrBeforeCents) return { kind: "none" };
    return input.mrrAfterCents > input.mrrBeforeCents
      ? { kind: "expansion" }
      : { kind: "contraction" };
  }

  // Other reasons (manual, upcoming, etc.): no logo/MRR lifecycle event from this path
  return { kind: "none" };
}
