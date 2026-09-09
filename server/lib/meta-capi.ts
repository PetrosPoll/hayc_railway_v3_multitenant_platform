import { createHash } from "crypto";

export async function sendMetaEvent({
  eventName,
  email,
  sourceUrl,
}: {
  eventName: string;
  email: string;
  sourceUrl: string;
}): Promise<void> {
  try {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!pixelId || !accessToken) {
      console.error("Meta CAPI: META_PIXEL_ID or META_ACCESS_TOKEN missing");
      return;
    }

    const hashedEmail = createHash("sha256")
      .update(email.toLowerCase().trim())
      .digest("hex");

    console.log(`📊 Sending Meta CAPI event: ${eventName} for ${email}, pixelId present: ${!!pixelId}, token present: ${!!accessToken}`);
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_source_url: sourceUrl,
              action_source: "system_generated",
              user_data: { em: [hashedEmail] },
            },
          ],
        }),
      },
    );

    console.log(`📊 Meta CAPI response status: ${response.status}`);
    const responseBody = await response.text();
    console.log(`📊 Meta CAPI response body: ${responseBody}`);
    if (!response.ok) {
      console.error("Meta CAPI request failed:", response.status, responseBody);
    }
  } catch (error) {
    console.error("Meta CAPI error:", error);
  }
}
