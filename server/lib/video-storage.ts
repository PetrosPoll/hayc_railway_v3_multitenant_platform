import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

function bucket() {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("Το S3 δεν είναι ρυθμισμένο.");
  return name;
}

export async function putVideoObject(key: string, body: Readable, contentType: string, contentLength: number) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentLength: contentLength,
  }));
}

export async function presignVideoDownload(key: string) {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(s3, command, { expiresIn: 2 * 60 * 60 });
}

export async function deleteVideoObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
