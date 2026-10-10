/** Platform From address for all customer newsletter campaigns (SES-verified). */
export const NEWSLETTER_FROM_EMAIL = "newsletter@hayc.gr";

/**
 * `newsletter_campaigns.sender_email` stores the customer Reply-To address.
 * Empty / null means no Reply-To (no-reply).
 */
export function getNewsletterReplyToAddresses(
  replyToEmail: string | null | undefined,
): string[] | undefined {
  const trimmed = replyToEmail?.trim();
  if (!trimmed) return undefined;
  return [trimmed];
}
