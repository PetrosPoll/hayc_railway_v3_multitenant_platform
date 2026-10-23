import { v2 as cloudinary } from "cloudinary";
import type { ReceptionFile } from "@shared/schema";
import { zipEntryName, zipStore } from "./reception-logic";

function client() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error("Cloudinary is not configured");
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return cloudinary;
}

export async function uploadReceptionFile(params: {
  buffer: Buffer;
  folder: string;
  publicId: string;
  resourceType: "image" | "raw";
}): Promise<ReceptionFile & { bytes: number }> {
  const c = client();
  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const stream = c.uploader.upload_stream(
      {
        folder: params.folder,
        public_id: params.publicId,
        resource_type: params.resourceType,
        type: "authenticated",
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      },
      (err, uploaded) => {
        if (err || !uploaded) reject(err || new Error("Cloudinary upload failed"));
        else resolve(uploaded as unknown as Record<string, unknown>);
      },
    );
    stream.end(params.buffer);
  });

  const publicId = String(result.public_id || "");
  if (!publicId) throw new Error("Cloudinary did not return a public id");
  const deliveryType = String(result.type || "");
  if (deliveryType && deliveryType !== "authenticated") {
    throw new Error("Cloudinary stored the file as public");
  }

  return {
    publicId,
    resourceType: params.resourceType,
    mime: null,
    size: typeof result.bytes === "number" ? result.bytes : params.buffer.length,
    ext: "",
    bytes: typeof result.bytes === "number" ? result.bytes : params.buffer.length,
  };
}

export function signedReceptionUrl(file: Pick<ReceptionFile, "publicId" | "resourceType">): string {
  const c = client();
  return c.url(file.publicId, {
    resource_type: file.resourceType || "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
  });
}

export async function zipReceptionFiles(
  files: { docKey: string; ext: string; file: ReceptionFile }[],
): Promise<Buffer> {
  const counts = new Map<string, number>();
  const packed: { name: string; data: Buffer }[] = [];
  for (const item of files) {
    const n = (counts.get(item.docKey) || 0) + 1;
    counts.set(item.docKey, n);
    const url = signedReceptionUrl(item.file);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not download ${item.docKey}`);
    }
    const data = Buffer.from(await res.arrayBuffer());
    packed.push({ name: zipEntryName(item.docKey, n, item.ext), data });
  }
  return zipStore(packed);
}
