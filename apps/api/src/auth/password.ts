export const PASSWORD_SCHEME = "scrypt-v1";
export const DUMMY_HASH = `${PASSWORD_SCHEME}:00000000000000000000000000000000:${"0".repeat(128)}`;
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${PASSWORD_SCHEME}:${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [kind, salt, expected] = encoded.split(":");
  if (kind !== PASSWORD_SCHEME || !salt || !expected) return false;
  const actual = await derive(password, salt);
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
