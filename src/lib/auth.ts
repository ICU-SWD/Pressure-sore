import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// This module must stay Edge-runtime-safe (no Node `crypto`, `fs`, etc.)
// because middleware.ts imports it and Next.js runs middleware on the Edge
// Runtime. PIN hashing lives in ./pin.ts instead.

export const SESSION_COOKIE = "pspg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h shift

function authSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Copy .env.example to .env and set it.");
  }
  return new TextEncoder().encode(secret);
}

// --- Session JWT (jose — edge-compatible, usable from middleware too) ---

export type SessionPayload = {
  userId: string;
  name: string;
  role: "ADMIN" | "NURSE";
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(authSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.name === "string" &&
      (payload.role === "ADMIN" || payload.role === "NURSE")
    ) {
      return { userId: payload.userId, name: payload.name, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}

// --- Server-side session helpers (App Router server components / route handlers) ---

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
