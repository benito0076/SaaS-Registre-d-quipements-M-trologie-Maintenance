import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ValidationError } from "./errors";

/**
 * Stockage des certificats (PDF / photos).
 *  - Clé d'objet : certificates/{orgId}/{uuid}.{ext} — le nom d'origine n'est
 *    jamais utilisé dans la clé (§5 – Intégrité documentaire).
 *  - Le bucket reste privé ; les fichiers sont servis par une URL signée
 *    valable SIGNED_URL_TTL secondes, délivrée après contrôle d'appartenance.
 *  - STORAGE_DRIVER=local stocke les fichiers dans .uploads/ (développement).
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 300;

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const ACCEPTED_UPLOAD_TYPES = Object.keys(ALLOWED_TYPES).join(",");

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

function driver(): "s3" | "local" {
  return process.env.STORAGE_DRIVER === "local" ? "local" : "s3";
}

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return s3;
}

function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET n'est pas défini");
  return b;
}

/** Vérifie la signature binaire du fichier (on ne se fie pas au type déclaré). */
function sniffType(bytes: Uint8Array): string | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts([0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (["heic", "heix", "mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heic";
  }
  return null;
}

export interface StoredFile {
  key: string;
  fileName: string;
}

export async function storeCertificate(orgId: string, file: File): Promise<StoredFile> {
  if (file.size === 0) throw new ValidationError("emptyFile");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError("fileTooLarge");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffType(bytes);
  if (!contentType) {
    throw new ValidationError("unsupportedFile");
  }
  const key = `certificates/${orgId}/${randomUUID()}.${ALLOWED_TYPES[contentType]}`;
  const fileName = sanitizeFileName(file.name || `certificat.${ALLOWED_TYPES[contentType]}`);

  if (driver() === "local") {
    const target = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  } else {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: bytes,
        ContentType: contentType,
        ContentDisposition: `inline; filename="${asciiFileName(fileName)}"`,
      }),
    );
  }
  return { key, fileName };
}

export async function deleteCertificate(key: string): Promise<void> {
  if (driver() === "local") {
    await unlink(path.join(LOCAL_DIR, key)).catch(() => undefined);
    return;
  }
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** URL signée à courte durée de vie (driver S3). */
export async function signedCertificateUrl(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `inline; filename="${asciiFileName(fileName)}"`,
    }),
    { expiresIn: SIGNED_URL_TTL },
  );
}

/** Lecture directe (driver local uniquement : le fichier est servi par proxy). */
export async function readLocalCertificate(key: string): Promise<Uint8Array> {
  const resolved = path.resolve(LOCAL_DIR, key);
  if (!resolved.startsWith(LOCAL_DIR + path.sep)) throw new Error("Clé invalide");
  return new Uint8Array(await readFile(resolved));
}

export function isLocalStorage(): boolean {
  return driver() === "local";
}

export function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop() ?? "";
  const entry = Object.entries(ALLOWED_TYPES).find(([, e]) => e === ext);
  return entry?.[0] ?? "application/octet-stream";
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/\x00-\x1f"]/g, "_").trim();
  return (cleaned || "certificat").slice(0, 200);
}

function asciiFileName(name: string): string {
  return name.normalize("NFKD").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "_");
}
