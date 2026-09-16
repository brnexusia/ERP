import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertAnyPermission, assertPermission } from "@/lib/auth/permissions";
import type {
  FilePurpose,
  FileUploadMetadata,
  FileVisibility,
} from "@/modules/storage/schema";

export type FileStorageAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export class FileStorageRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileStorageRuleError";
  }
}

export class FileStorageNotFoundError extends Error {
  constructor(message = "Arquivo não encontrado.") {
    super(message);
    this.name = "FileStorageNotFoundError";
  }
}

export class FileStorageUnsupportedTypeError extends Error {
  constructor(message = "Tipo de arquivo não suportado.") {
    super(message);
    this.name = "FileStorageUnsupportedTypeError";
  }
}

const MIME_TYPES: Record<string, { extension: string; disposition: "inline" | "attachment" }> = {
  "image/jpeg": { extension: "jpg", disposition: "inline" },
  "image/png": { extension: "png", disposition: "inline" },
  "image/webp": { extension: "webp", disposition: "inline" },
  "image/gif": { extension: "gif", disposition: "inline" },
  "application/pdf": { extension: "pdf", disposition: "inline" },
  "text/plain": { extension: "txt", disposition: "attachment" },
  "text/csv": { extension: "csv", disposition: "attachment" },
  "application/msword": { extension: "doc", disposition: "attachment" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    disposition: "attachment",
  },
  "application/vnd.ms-excel": { extension: "xls", disposition: "attachment" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extension: "xlsx",
    disposition: "attachment",
  },
};

const EXTENSION_TO_MIME = Object.fromEntries(
  Object.entries(MIME_TYPES).map(([mimeType, config]) => [config.extension, { mimeType, ...config }]),
) as Record<string, { mimeType: string; extension: string; disposition: "inline" | "attachment" }>;

function storageRoot(): string {
  return path.resolve(process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage"));
}

function maxUploadBytes(): number {
  const configured = Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 25 * 1024 * 1024;
}

function fileTokenSecret(): string {
  const configured = process.env.FILE_TOKEN_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FILE_TOKEN_SECRET deve possuir pelo menos 32 caracteres em produção.");
  }
  return "erp-pedro-development-file-token-secret-only";
}

function assertPurposePermission(role: MembershipRole, purpose: FilePurpose): void {
  if (purpose === "PRODUCT_IMAGE") {
    assertPermission(role, "inventory:write");
    return;
  }
  if (purpose === "DELIVERY_PROOF") {
    assertPermission(role, "sales:write");
    return;
  }
  if (purpose === "CLIENT_FILE") {
    assertPermission(role, "clients:write");
    return;
  }
  assertAnyPermission(role, ["organization:manage", "inventory:write", "sales:write", "clients:write"]);
}

type FileTokenPayload = {
  key: string;
  purpose: FilePurpose;
};

function signatureFor(encodedPayload: string): string {
  return createHmac("sha256", fileTokenSecret()).update(encodedPayload).digest("base64url");
}

export function encodeFileToken(payload: FileTokenPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signatureFor(encodedPayload)}`;
}

export function decodeFileToken(token: string): FileTokenPayload {
  try {
    const [encodedPayload, signature, extra] = token.split(".");
    if (!encodedPayload || !signature || extra !== undefined) throw new Error("invalid");

    const expectedSignature = signatureFor(encodedPayload);
    const actualBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (
      actualBuffer.byteLength !== expectedBuffer.byteLength ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new Error("invalid");
    }

    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<FileTokenPayload>;
    if (typeof parsed.key !== "string" || typeof parsed.purpose !== "string") {
      throw new Error("invalid");
    }
    if (!["PRODUCT_IMAGE", "DELIVERY_PROOF", "CLIENT_FILE", "OTHER"].includes(parsed.purpose)) {
      throw new Error("invalid");
    }
    validateStorageKey(parsed.key);
    return parsed as FileTokenPayload;
  } catch (error) {
    if (error instanceof FileStorageNotFoundError) throw error;
    throw new FileStorageNotFoundError();
  }
}

function validateStorageKey(key: string): {
  organizationId: string;
  visibility: FileVisibility;
  storedName: string;
  extension: string;
} {
  const parts = key.split("/");
  if (parts.length !== 3) throw new FileStorageNotFoundError();
  const [organizationId, visibility, storedName] = parts;
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(organizationId)) throw new FileStorageNotFoundError();
  if (visibility !== "public" && visibility !== "private") throw new FileStorageNotFoundError();
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([a-z0-9]{2,5})$/i.exec(storedName);
  if (!match) throw new FileStorageNotFoundError();
  const extension = match[2].toLowerCase();
  if (!EXTENSION_TO_MIME[extension]) throw new FileStorageNotFoundError();
  return { organizationId, visibility, storedName, extension };
}

function absolutePathForKey(key: string): string {
  const validated = validateStorageKey(key);
  const root = storageRoot();
  const absolutePath = path.resolve(root, validated.organizationId, validated.visibility, validated.storedName);
  const allowedPrefix = `${path.resolve(root, validated.organizationId, validated.visibility)}${path.sep}`;
  if (!absolutePath.startsWith(allowedPrefix)) throw new FileStorageNotFoundError();
  return absolutePath;
}

function publicUrlForToken(token: string, visibility: FileVisibility): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const relative = visibility === "public" ? `/api/public/files/${token}` : `/api/files/${token}`;
  return new URL(relative, base).toString();
}

function sanitizeOriginalName(name: string): string {
  const normalized = name.normalize("NFKC").replace(/[\r\n\t]/g, " ").trim();
  const basename = path.basename(normalized).replace(/[^A-Za-z0-9._ ()-]/g, "_");
  return basename.slice(0, 200) || "arquivo";
}

export async function storeFile(
  context: FileStorageAccessContext,
  file: File,
  metadata: FileUploadMetadata,
) {
  assertPurposePermission(context.role, metadata.purpose);

  const mimeConfig = MIME_TYPES[file.type];
  if (!mimeConfig) throw new FileStorageUnsupportedTypeError();
  if (file.size <= 0) throw new FileStorageRuleError("Arquivo vazio não pode ser armazenado.");
  if (file.size > maxUploadBytes()) {
    throw new FileStorageRuleError(`Arquivo excede o limite técnico de ${maxUploadBytes()} bytes.`);
  }
  if (metadata.purpose === "PRODUCT_IMAGE" && !file.type.startsWith("image/")) {
    throw new FileStorageRuleError("Imagem de produto precisa ser enviada em formato de imagem suportado.");
  }

  const storedName = `${randomUUID()}.${mimeConfig.extension}`;
  const key = `${context.organizationId}/${metadata.visibility}/${storedName}`;
  const absolutePath = absolutePathForKey(key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer, { flag: "wx" });

  const token = encodeFileToken({ key, purpose: metadata.purpose });
  const originalName = sanitizeOriginalName(file.name);

  await db.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action: "FILE_UPLOAD",
      entityType: "StoredFile",
      entityId: key,
      metadata: {
        purpose: metadata.purpose,
        visibility: metadata.visibility,
        originalName,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    },
  });

  return {
    token,
    url: publicUrlForToken(token, metadata.visibility),
    visibility: metadata.visibility,
    purpose: metadata.purpose,
    originalName,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export async function readStoredFile(token: string) {
  const decoded = decodeFileToken(token);
  const validated = validateStorageKey(decoded.key);
  const absolutePath = absolutePathForKey(decoded.key);

  try {
    const data = await readFile(absolutePath);
    const mime = EXTENSION_TO_MIME[validated.extension];
    return {
      data,
      organizationId: validated.organizationId,
      visibility: validated.visibility,
      purpose: decoded.purpose,
      mimeType: mime.mimeType,
      disposition: mime.disposition,
      storedName: validated.storedName,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new FileStorageNotFoundError();
    throw error;
  }
}

export async function removeStoredFile(
  context: FileStorageAccessContext,
  token: string,
) {
  const decoded = decodeFileToken(token);
  const validated = validateStorageKey(decoded.key);
  if (validated.organizationId !== context.organizationId) throw new FileStorageNotFoundError();
  assertPurposePermission(context.role, decoded.purpose);

  try {
    await unlink(absolutePathForKey(decoded.key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new FileStorageNotFoundError();
    throw error;
  }

  await db.auditLog.create({
    data: {
      organizationId: context.organizationId,
      userId: context.userId,
      action: "FILE_DELETE",
      entityType: "StoredFile",
      entityId: decoded.key,
      metadata: {
        purpose: decoded.purpose,
        visibility: validated.visibility,
      },
    },
  });

  return { removed: true as const };
}
