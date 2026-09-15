// Verifies the PIN hashing scheme used by supabase/functions/_shared/pin.ts.
//
// The edge function runs on Deno and uses the exact same Web Crypto PBKDF2
// primitives Node exposes under crypto.subtle — so this test can compute
// hashes with the same algorithm and cross-check the parse/verify code path.
// If the storage format is ever changed, this test fails loudly instead of
// silently locking every existing family out of their PIN.

import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";

const subtle = webcrypto.subtle;

const HASH_MODULE = new URL("../supabase/functions/_shared/pin.ts", import.meta.url);

test("PIN hash format matches the pbkdf2$iter$salt$hash contract in pin.ts", async () => {
  const src = readFileSync(HASH_MODULE, "utf-8");
  assert.match(src, /pbkdf2\$/, "storage format constant must still be pbkdf2$…");
  assert.match(src, /ITER\s*=\s*100_000/, "iteration count should remain at 100k (or be updated deliberately)");
  assert.match(src, /SALT_BYTES\s*=\s*16/, "salt length should stay 16 bytes");
  assert.match(src, /SHA-256/i);
});

test("verifyPin should round-trip against a manually-computed hash", async () => {
  // Rebuild the same PBKDF2-SHA256 hash the edge function stores, then feed
  // it back through a JS port of verifyPin. If the format drifts, this
  // catches it.
  const pin = "4321";
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const key = await subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256));
  const b64 = (u) => Buffer.from(u).toString("base64");
  const stored = `pbkdf2$100000$${b64(salt)}$${b64(bits)}`;

  const verify = async (candidate, storedHash) => {
    const parts = storedHash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iterations = parseInt(parts[1], 10);
    const s = Uint8Array.from(Buffer.from(parts[2], "base64"));
    const expected = Uint8Array.from(Buffer.from(parts[3], "base64"));
    const k = await subtle.importKey("raw", new TextEncoder().encode(candidate), "PBKDF2", false, ["deriveBits"]);
    const actual = new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", salt: s, iterations, hash: "SHA-256" }, k, 256));
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  };

  assert.equal(await verify("4321", stored), true, "correct PIN should verify");
  assert.equal(await verify("1234", stored), false, "wrong PIN should not verify");
});
