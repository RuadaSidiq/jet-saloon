/**
 * File storage. Local driver writes to ./storage (outside /public). Public files are served via
 * /api/files/public/<key>; private files (identity documents) only via an authorised route.
 * Swap in an S3/R2 driver by implementing the same three functions.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomToken } from "./crypto";
import { AppError } from "./errors";

const ROOT = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");
const MAX = { image: 8 * 1024 * 1024, document: 10 * 1024 * 1024, video: 50 * 1024 * 1024 };

const SIGNATURES: { mime: string; ext: string; kind: keyof typeof MAX; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", kind: "image", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", kind: "image", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", kind: "image", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", kind: "document", test: (b) => b.subarray(0, 5).toString() === "%PDF-" },
  { mime: "video/mp4", ext: "mp4", kind: "video", test: (b) => b.subarray(4, 8).toString() === "ftyp" },
];

/** Validate by magic bytes (not the client-declared type) and size. */
export function sniff(buf: Buffer, allowed: ("image" | "document" | "video")[]) {
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig || !allowed.includes(sig.kind)) throw new AppError("FILE_TYPE", `Unsupported file type. Allowed: ${allowed.join(", ")}`);
  if (buf.length > MAX[sig.kind]) throw new AppError("FILE_SIZE", `File is too large (max ${MAX[sig.kind] / 1024 / 1024}MB)`);
  return sig;
}

export async function saveFile(file: File, visibility: "public" | "private", allowed: ("image" | "document" | "video")[]) {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw new AppError("FILE_EMPTY", "The file is empty");
  const sig = sniff(buf, allowed);
  const key = `${new Date().toISOString().slice(0, 7)}/${randomToken(16)}.${sig.ext}`;
  const full = path.join(ROOT, visibility, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return { key, mime: sig.mime, size: buf.length, url: visibility === "public" ? `/api/files/public/${key}` : null };
}

export async function readStored(visibility: "public" | "private", key: string) {
  if (!/^[\w-]+\/[\w-]+\.(jpg|png|webp|pdf|mp4)$/.test(key)) throw new AppError("NOT_FOUND", "Not found", 404);
  return readFile(path.join(ROOT, visibility, key));
}

export const mimeFor = (key: string) => SIGNATURES.find((s) => key.endsWith("." + s.ext))?.mime ?? "application/octet-stream";
