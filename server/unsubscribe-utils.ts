import crypto from 'crypto';

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'hayc-unsubscribe-secret-key-2024';
const TOKEN_EXPIRY_DAYS = 14;

export interface UnsubscribeTokenPayload {
  contactId: number;
  websiteProgressId: number;
  email: string;
  expiresAt: number;
}

export function generateUnsubscribeToken(contactId: number, websiteProgressId: number, email: string): string {
  const expiresAt = Date.now() + (TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  const payload: UnsubscribeTokenPayload = {
    contactId,
    websiteProgressId,
    email,
    expiresAt,
  };
  
  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  
  return `${payloadBase64}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): { valid: boolean; payload?: UnsubscribeTokenPayload; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'invalid_format' };
    }
    
    const [payloadBase64, signature] = parts;
    
    const expectedSignature = crypto
      .createHmac('sha256', UNSUBSCRIBE_SECRET)
      .update(payloadBase64)
      .digest('base64url');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, error: 'invalid_signature' };
    }
    
    const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: UnsubscribeTokenPayload = JSON.parse(payloadString);
    
    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'expired' };
    }
    
    return { valid: true, payload };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, error: 'invalid_token' };
  }
}

export function generateUnsubscribeUrl(baseUrl: string, contactId: number, websiteProgressId: number, email: string): string {
  const token = generateUnsubscribeToken(contactId, websiteProgressId, email);
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function generateUnsubscribeFooter(unsubscribeUrl: string, language: 'en' | 'gr' = 'en'): string {
  const texts = {
    en: {
      unsubscribe: 'Unsubscribe',
      unsubscribeText: 'If you no longer wish to receive these emails, you can',
      here: 'unsubscribe here',
    },
    gr: {
      unsubscribe: 'Κατάργηση εγγραφής',
      unsubscribeText: 'Εάν δεν επιθυμείτε πλέον να λαμβάνετε αυτά τα emails, μπορείτε να',
      here: 'καταργήσετε την εγγραφή σας εδώ',
    },
  };
  
  const t = texts[language] || texts.en;
  
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
      <p style="margin: 0;">
        ${t.unsubscribeText} <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">${t.here}</a>.
      </p>
    </div>
  `;
}
