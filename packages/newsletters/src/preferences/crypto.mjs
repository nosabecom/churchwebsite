import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

function assertSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("NEWSLETTER_VERIFICATION_SECRET must contain at least 32 characters.");
  }
}

function encryptionKey(secret) {
  assertSecret(secret);
  return createHash("sha256").update(`encryption:${secret}`).digest();
}

export function createVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueValue(value, secret, purpose) {
  assertSecret(secret);
  return createHmac("sha256", secret)
    .update(`${purpose}:${value}`)
    .digest("base64url");
}

export function encryptPreferencePayload(payload, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((value) => value.toString("base64url")).join(".");
}

export function decryptPreferencePayload(value, secret) {
  const parts = typeof value === "string" ? value.split(".") : [];
  if (parts.length !== 3) throw new Error("Invalid encrypted preference payload.");

  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) {
    throw new Error("Invalid encrypted preference payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
