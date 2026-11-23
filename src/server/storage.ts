/**
 * File storage backed by Postgres (StoredFile), so uploads survive serverless deploys.
 * Public files are served via /api/files/public/<key>; private files (identity documents)
 * only via an authorised route. Files are validated by magic bytes, never the declared type.
 * Vercel caps request bodies at ~4.5MB, so uploads are limited to 4MB.
 */
import { db } from "./db";
import { randomToken } from "./crypto";
import { AppError } from "./errors";

export const MAX_UPLOAD_MB = 4;
const MAX = { image: MAX_UPLOAD_MB * 1024 * 1024, document: MAX_UPLOAD_MB * 1024 * 1024, video: MAX_UPLOAD_MB * 1024 * 1024 };

const SIGNATURES: { mime: string; ext: string; kind: keyof typeof MAX; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", kind: "image", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", kind: "image", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", kind: "image", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", kind: "document", test: (b) => b.subarray(0, 5).toString() === "%PDF-" },
  { mime: "video/mp4", ext: "mp4", kind: "video", test: (b) => b.subarray(4, 8).toString() === "ftyp" },
];

export function sniff(buf: Buffer, allowed: ("image" | "document" | "video")[]) {
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig || !allowed.includes(sig.kind)) throw new AppError("FILE_TYPE", `Unsupported file type. Allowed: ${allowed.join(", ")}`);
  if (buf.length > MAX[sig.kind]) throw new AppError("FILE_SIZE", `File is too large (max ${MAX_UPLOAD_MB}MB)`);
  return sig;
}

export async function saveFile(file: File, visibility: "public" | "private", allowed: ("image" | "document" | "video")[]) {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw new AppError("FILE_EMPTY", "The file is empty");
  const sig = sniff(buf, allowed);
  const key = `${new Date().toISOString().slice(0, 7)}/${randomToken(16)}.${sig.ext}`;
  await db.storedFile.create({ data: { key, visibility, mimeType: sig.mime, sizeBytes: buf.length, data: buf } });
  return { key, mime: sig.mime, size: buf.length, url: visibility === "public" ? `/api/files/public/${key}` : null };
}

export async function readStored(visibility: "public" | "private", key: string) {
  if (!/^[\w-]+\/[\w-]+\.(jpg|png|webp|pdf|mp4)$/.test(key)) throw new AppError("NOT_FOUND", "Not found", 404);
  const f = await db.storedFile.findUnique({ where: { key } });
  if (!f || f.visibility !== visibility) throw new AppError("NOT_FOUND", "Not found", 404);
  return Buffer.from(f.data);
}

export const mimeFor = (key: string) => SIGNATURES.find((s) => key.endsWith("." + s.ext))?.mime ?? "application/octet-stream";
