import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

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
  const bucket = process.env.S3_BUCKET;
  const configKey = `sites/${siteId}/config/config.json`;
  const historyPrefix = `sites/${siteId}/config/history/`;

  try {
    const currentConfigResponse = await s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: configKey,
    }));
    const currentBody = await currentConfigResponse.Body?.transformToString();
    if (currentBody) {
      const timestamp = Date.now();
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${historyPrefix}${timestamp}.json`,
        Body: currentBody,
        ContentType: "application/json",
      }));
    }
  } catch (error: any) {
    if (error.name !== "NoSuchKey" && error.Code !== "NoSuchKey") {
      console.error(`Failed to snapshot config for site ${siteId}:`, error.message);
    }
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: configKey,
    Body: JSON.stringify(config, null, 2),
    ContentType: "application/json",
  });

  try {
    await s3Client.send(command);
  } catch (error: any) {
    throw new Error(`Failed to save config for site ${siteId}: ${error.message}`);
  }
}

export async function getConfigHistory(siteId: string): Promise<Array<{ versionKey: string; timestamp: number; lastModified: string }>> {
  const bucket = process.env.S3_BUCKET;
  const historyPrefix = `sites/${siteId}/config/history/`;

  const listResponse = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: historyPrefix,
  }));

  const objects = listResponse.Contents || [];
  const sorted = objects
    .filter(obj => obj.Key)
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
    .slice(0, 10);

  return sorted.map(obj => {
    const filename = obj.Key!.replace(historyPrefix, "").replace(".json", "");
    return {
      versionKey: obj.Key!,
      timestamp: parseInt(filename, 10),
      lastModified: obj.LastModified?.toISOString() || "",
    };
  });
}

export async function getConfigSnapshot(siteId: string, versionKey: string): Promise<Record<string, unknown>> {
  const bucket = process.env.S3_BUCKET;
  const expectedPrefix = `sites/${siteId}/config/history/`;

  if (!versionKey.startsWith(expectedPrefix)) {
    throw new Error("Invalid versionKey for this site");
  }

  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: versionKey,
  }));

  const body = await response.Body?.transformToString();
  if (!body) {
    throw new Error("Snapshot file is empty");
  }

  return JSON.parse(body);
}

export async function restoreConfig(siteId: string, versionKey: string): Promise<void> {
  const config = await getConfigSnapshot(siteId, versionKey);
  await putConfig(siteId, config);
}
