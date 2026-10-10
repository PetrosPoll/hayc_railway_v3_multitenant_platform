/** Platform From address for all customer newsletter campaigns (SES-verified). */
export const NEWSLETTER_FROM_EMAIL = "newsletter@hayc.gr";

/** Solid fallback used when CSS image backgrounds are stripped for email clients. */
export const NEWSLETTER_EMAIL_BG_FALLBACK = "#f6f9fc";

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

/**
 * Safety net for leftover data-URI CSS backgrounds (break many clients / dump
 * base64 as text). Content images should already be HTTPS (Cloudinary) after import.
 * Does not touch https:// backgrounds or <img src="https://...">.
 */
export function sanitizeNewsletterHtmlForSend(html: string): string {
  if (!html || !html.includes("data:image")) return html;

  let out = html;

  out = out.replace(
    /background-image\s*:\s*url\(\s*(['"]?)data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+\1\s*\)\s*;?/gi,
    "background-image: none;",
  );

  out = out.replace(
    /background\s*:\s*url\(\s*(['"]?)data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+\1\s*\)\s*;?/gi,
    `background: ${NEWSLETTER_EMAIL_BG_FALLBACK};`,
  );

  out = out.replace(
    /\sbackground\s*=\s*(['"])data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+\1/gi,
    ` background="${NEWSLETTER_EMAIL_BG_FALLBACK}"`,
  );

  return out;
}
