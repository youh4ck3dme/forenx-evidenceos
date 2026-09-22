import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { sha256Hex } from "./sha256.ts";

// Node test runner has no global crypto.subtle by default in older setups.
if (!globalThis.crypto) {
  // @ts-expect-error assign webcrypto for tests
  globalThis.crypto = webcrypto;
}

test("sha256Hex is lowercase hex of length 64", async () => {
  const a = await sha256Hex(new TextEncoder().encode("ForenX"));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("same bytes → same hash", async () => {
  const payload = new TextEncoder().encode("%PDF-1.7 custody");
  const h1 = await sha256Hex(payload);
  const h2 = await sha256Hex(payload);
  assert.equal(h1, h2);
});

test("one-byte change → different hash", async () => {
  const a = new TextEncoder().encode("evidence-A");
  const b = new TextEncoder().encode("evidence-B");
  const ha = await sha256Hex(a);
  const hb = await sha256Hex(b);
  assert.notEqual(ha, hb);
});

test("empty buffer has known SHA-256", async () => {
  const empty = await sha256Hex(new Uint8Array(0));
  assert.equal(empty, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});
