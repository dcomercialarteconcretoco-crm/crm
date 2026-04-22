import bcrypt from 'bcryptjs';

/**
 * Password utilities with backward compatibility.
 *
 * Passwords stored before hashing was introduced exist as plain text in the DB.
 * `verifyPassword` handles both: it detects bcrypt hashes and plain-text values.
 * When a plain-text match succeeds, the caller should rehash and persist.
 */

const BCRYPT_PREFIX_RE = /^\$2[aby]\$/;

export function isBcryptHash(value: string): boolean {
  return typeof value === 'string' && BCRYPT_PREFIX_RE.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!plain || !stored) return false;
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored);
  }
  return stored === plain;
}
