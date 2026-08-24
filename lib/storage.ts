// Pluggable file storage for delivery photos and signatures.
// Defaults to local disk (public/uploads) for development.
// Set S3_BUCKET (+ S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, optionally S3_ENDPOINT)
// to switch to S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2) in production.
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

const s3Configured = Boolean(
  process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
);

export interface StoredFile {
  url: string;
  key: string;
}

function extensionFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "bin";
}

async function saveLocal(buffer: Buffer, mime: string, prefix: string): Promise<StoredFile> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads", prefix);
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${randomUUID()}.${extensionFromMime(mime)}`;
  await writeFile(path.join(uploadsDir, filename), buffer);
  return { url: `/uploads/${prefix}/${filename}`, key: `${prefix}/${filename}` };
}

async function saveS3(buffer: Buffer, mime: string, prefix: string): Promise<StoredFile> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  const key = `${prefix}/${randomUUID()}.${extensionFromMime(mime)}`;
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
    })
  );
  const publicBase = process.env.S3_PUBLIC_URL_BASE;
  const url = publicBase
    ? `${publicBase.replace(/\/$/, "")}/${key}`
    : `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
  return { url, key };
}

/**
 * Persist a captured photo, signature, or damage image.
 * `prefix` groups files by kind, e.g. "photos", "signatures", "damage".
 */
export async function saveUpload(dataUrl: string, prefix: string): Promise<StoredFile> {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid data URL");
  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  if (buffer.byteLength > 8 * 1024 * 1024) {
    throw new Error("File exceeds 8MB limit");
  }

  return s3Configured ? saveS3(buffer, mime, prefix) : saveLocal(buffer, mime, prefix);
}

export const storageBackend = s3Configured ? "s3" : "local";
