import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) {
    throw new Error("A senha deve ter pelo menos 10 caracteres.");
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = storedHash.split("$");

  if (algorithm !== "scrypt" || !saltHex || !keyHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");

  if (expectedKey.length !== KEY_LENGTH) {
    return false;
  }

  const actualKey = (await scrypt(password, salt, expectedKey.length)) as Buffer;
  return timingSafeEqual(actualKey, expectedKey);
}
