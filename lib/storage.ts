// Pluggable file storage for delivery photos and signatures.
// Defaults to local disk for development. Set S3_BUCKET (+ S3_REGION,
// S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, optionally S3_ENDPOINT) to switch
// to S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2) in
// production.
//
// Neither backend is directly web-servable. Local files are written under
// a private directory outside Next.js's public/ static root, and S3 files
// are written to what should be a private (non-public-read) bucket. The
// only way to view a file is through the authorised routes in
// app/api/files/*, which check the requester actually has a reason to see
// that specific delivery's photo/signature before serving it — see
// lib/fileAccess.ts. Previously saved files returned a permanently public
// URL (a static /uploads/ path, or a public S3 bucket URL); resolveStoredFile
// below still honours those old references so already-uploaded files keep
// working, but every new upload is private by default.
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";

const s3Configured = Boolean(
  process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
);

export interface StoredFile {
  /** Opaque reference to persist on the DB record — never a directly browsable URL. */
  url: string;
  key: string;
}

const PRIVATE_UPLOADS_DIR = path.join(process.cwd(), "private-uploads");

function extensionFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "bin";
}

function mimeFromExtension(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

async function saveLocal(buffer: Buffer, mime: string, prefix: string): Promise<StoredFile> {
  const dir = path.join(PRIVATE_UPLOADS_DIR, prefix);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${extensionFromMime(mime)}`;
  await writeFile(path.join(dir, filename), buffer);
  const key = `${prefix}/${filename}`;
  return { url: key, key };
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
  return { url: key, key };
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

export type ResolvedFile =
  | { kind: "redirect"; url: string }
  | { kind: "stream"; buffer: Buffer; contentType: string };

// Turns a stored reference (a bare key from a new-style upload, or a legacy
// full URL from before files were made private) into something an API
// route can actually serve. Only called after the caller has already
// confirmed the requester is authorised to see this specific file — see
// app/api/files/*.
export async function resolveStoredFile(reference: string): Promise<ResolvedFile> {
  if (reference.startsWith("http://") || reference.startsWith("https://") || reference.startsWith("/uploads/")) {
    // Legacy public reference from before this file became private — still
    // honoured so old records don't break, but it was never re-secured
    // retroactively (there's nothing to authorise against once a URL has
    // already been public).
    return { kind: "redirect", url: reference };
  }

  if (s3Configured) {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    // Generated fresh for this one authorised request, short-lived rather
    // than a durable public link — not pre-generated for every photo on a
    // page, only for the one actually being opened.
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: reference }), {
      expiresIn: 300,
    });
    return { kind: "redirect", url };
  }

  const ext = reference.split(".").pop() ?? "";
  const buffer = await readFile(path.join(PRIVATE_UPLOADS_DIR, reference));
  return { kind: "stream", buffer, contentType: mimeFromExtension(ext) };
}
