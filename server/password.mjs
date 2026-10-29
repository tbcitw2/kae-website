// scrypt password hashing: "scrypt$<salt hex>$<hash hex>"
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const derive = (pw, salt) => new Promise((ok, fail) =>
  scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? fail(err) : ok(key))));

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await derive(pw, salt)).toString('hex')}`;
}

export async function verifyPassword(pw, stored) {
  const [kind, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const key = await derive(pw, Buffer.from(salt, 'hex'));
  const want = Buffer.from(hash, 'hex');
  return key.length === want.length && timingSafeEqual(key, want);
}
