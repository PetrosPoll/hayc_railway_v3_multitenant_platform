import { db } from "../db";
import { websiteInvoices, websiteProgress } from "@shared/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";

/**
 * NOTE: For local development, you need to expose your localhost using a tunnel service:
 * - ngrok: `ngrok http 5000` then use https://your-id.ngrok.io/api/wrapp-webhook
 * - localtunnel: `npx localtunnel --port 5000` then use the provided URL
 * 
 * Configure the webhook URL in your Wrapp dashboard to point to your tunnel URL.
 */

/**
 * Webhook payload structure from Wrapp API for PDF generation completion
 */
interface WrappPdfGenerationWebhook {
  /** Invoice ID from Wrapp */
  invoice_id?: string;
  id?: string;
  /** PDF URL when generation is complete */
  pdf_url?: string;
  pdfUrl?: string;
  /** Download URL (Wrapp uses this field) */
  download_url?: string;
  downloadUrl?: string;
  /** Invoice status */
  status?: string;
  /** Additional data that might be nested */
  data?: {
    id?: string;
    attributes?: {
      pdf_url?: string;
      pdfUrl?: string;
      download_url?: string;
      downloadUrl?: string;
      status?: string;
    };
  };
}

/**
 * Handles Wrapp webhook for PDF generation completion
 * Updates the invoice record with the PDF URL and marks it as COMPLETED
 * 
 * @param payload - Webhook payload from Wrapp
 * @returns Object with success status and updated invoice info
 */
export async function handleWrappPdfGenerationWebhook(
  payload: WrappPdfGenerationWebhook
): Promise<{ success: boolean; invoiceId?: number; message: string }> {
  try {
    // Extract invoice ID from various possible payload structures
    const wrappInvoiceId = 
      payload.invoice_id || 
      payload.id || 
      payload.data?.id;

    if (!wrappInvoiceId) {
      console.error('[Wrapp Webhook] Missing invoice ID in payload:', payload);
      return {
        success: false,
        message: 'Missing invoice ID in webhook payload'
      };
    }

    console.log('[Wrapp Webhook] Processing PDF generation for invoice:', wrappInvoiceId);

    // Extract PDF URL from various possible payload structures
    const pdfUrl = 
      payload.download_url || 
      payload.downloadUrl ||
      payload.pdf_url || 
      payload.pdfUrl || 
      payload.data?.attributes?.download_url ||
      payload.data?.attributes?.downloadUrl ||
      payload.data?.attributes?.pdf_url || 
      payload.data?.attributes?.pdfUrl;

    if (!pdfUrl) {
      console.warn('[Wrapp Webhook] PDF URL not found in payload, but continuing with status update');
    } else {
      console.log('[Wrapp Webhook] Extracted PDF URL:', pdfUrl);
    }

    // Find the invoice in our database by wrappInvoiceId
    const [invoice] = await db
      .select()
      .from(websiteInvoices)
      .where(eq(websiteInvoices.wrappInvoiceId, wrappInvoiceId))
      .limit(1);

    if (!invoice) {
      console.error('[Wrapp Webhook] Invoice not found in database:', wrappInvoiceId);
      return {
        success: false,
        message: `Invoice with wrappInvoiceId ${wrappInvoiceId} not found in database`
      };
    }

    console.log('[Wrapp Webhook] Found invoice:', {
      id: invoice.id,
      status: invoice.status,
      hasPdfUrl: !!pdfUrl
    });

    // Get website domain for Cloudinary folder structure
    const [website] = await db
      .select()
      .from(websiteProgress)
      .where(eq(websiteProgress.id, invoice.websiteProgressId))
      .limit(1);

    const domain = website?.domain || 'unknown';
    const folder = `transactions/${domain}`;

    // Update invoice with PDF URL (status is already COMPLETED from successful creation)
    const updateData: {
      pdfUrl?: string;
      cloudinaryPublicId?: string;
    } = {};

    // Download and upload to Cloudinary if PDF URL is available
    if (pdfUrl) {
      try {
        console.log('[Wrapp Webhook] Downloading PDF from:', pdfUrl);
        
        // Download PDF from S3 URL using fetch with AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const pdfResponse = await fetch(pdfUrl, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
        }

        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfArrayBuffer);
        console.log('[Wrapp Webhook] Downloaded PDF, size:', pdfBuffer.length, 'bytes');

        // Configure Cloudinary
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        // Upload to Cloudinary
        const uploadResult = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: folder,
              resource_type: 'raw',
              format: 'pdf',
              use_filename: true,
              unique_filename: true,
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          
          uploadStream.end(pdfBuffer);
        });

        console.log('[Wrapp Webhook] ✅ Uploaded to Cloudinary:', {
          publicId: uploadResult.public_id,
          url: uploadResult.secure_url
        });

        // Use Cloudinary URL instead of temporary S3 URL
        updateData.pdfUrl = uploadResult.secure_url;
        updateData.cloudinaryPublicId = uploadResult.public_id;

      } catch (uploadError: any) {
        console.error('[Wrapp Webhook] Failed to upload PDF to Cloudinary:', {
          error: uploadError.message,
          stack: uploadError.stack
        });
        
        // Fallback: use the original S3 URL if Cloudinary upload fails
        updateData.pdfUrl = pdfUrl;
        updateData.cloudinaryPublicId = pdfUrl.split('/').pop() || '';
        
        console.warn('[Wrapp Webhook] Using original S3 URL as fallback');
      }
    }

    await db
      .update(websiteInvoices)
      .set(updateData)
      .where(eq(websiteInvoices.id, invoice.id));

    console.log('[Wrapp Webhook] ✅ Invoice updated successfully:', {
      invoiceId: invoice.id,
      hasPdfUrl: !!pdfUrl
    });

    return {
      success: true,
      invoiceId: invoice.id,
      message: 'Invoice PDF generation completed and updated'
    };

  } catch (error: any) {
    console.error('[Wrapp Webhook] Error processing webhook:', {
      error: error.message,
      stack: error.stack,
      payload
    });

    return {
      success: false,
      message: `Error processing webhook: ${error.message}`
    };
  }
}

