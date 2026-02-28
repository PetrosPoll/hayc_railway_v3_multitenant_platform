import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export async function getConfig(siteId: string): Promise<Record<string, unknown>> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `sites/${siteId}/config/config.json`,
  });

  try {
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();

    if (!body) {
      throw new Error(`Config file for site ${siteId} is empty`);
    }

    try {
      return JSON.parse(body);
    } catch {
      throw new Error(`Failed to parse config.json for site ${siteId}: invalid JSON`);
    }
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
      throw new Error(`Config file not found for site ${siteId}`);
    }
    throw new Error(`Failed to get config for site ${siteId}: ${error.message}`);
  }
}

export async function putConfig(siteId: string, config: Record<string, unknown>): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `sites/${siteId}/config/config.json`,
    Body: JSON.stringify(config, null, 2),
    ContentType: "application/json",
  });

  try {
    await s3Client.send(command);
  } catch (error: any) {
    throw new Error(`Failed to save config for site ${siteId}: ${error.message}`);
  }
}
