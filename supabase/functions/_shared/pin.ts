// Shared PIN hashing + serialization helpers used by verify-pin and set-pin.
//
// Storage format for families.parent_pin_hash:
//   pbkdf2$<iterations>$<base64 salt>$<base64 hash>
//
// PBKDF2-SHA256 with 100 000 iterations is strong enough that even a full DB
// leak wouldn't let an attacker enumerate all 10 000 4-digit PINs cheaply,
// and it's available via the built-in Web Crypto API — no external dependency
// to pin, audit, or version.

const ITER = 100_000;
const SALT_BYTES = 16;

function b64encode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}
function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial, 256
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, ITER);
  return `pbkdf2$${ITER}$${b64encode(salt)}$${b64encode(hash)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64decode(parts[2]);
  const expected = b64decode(parts[3]);
  const actual = await derive(pin, salt, iterations);
  // Constant-time compare — same length by construction (32 bytes for SHA-256).
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function isValidPinShape(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}
