// PIN hashing (scrypt via Node's crypto module).
// Kept separate from auth.ts because auth.ts is imported by middleware.ts,
// which runs on the Edge Runtime where Node's `crypto` module isn't available.
// This file must only be imported from API routes / server actions (Node runtime).
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
