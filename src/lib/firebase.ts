// Firebase Admin SDK initializer.
// Lazy-init so dev/local without Firebase env vars still works (in-memory fallback).
//
// Service account is loaded from one of:
//   - FIREBASE_SERVICE_ACCOUNT_BASE64  (preferred: single-line base64 of full JSON)
//   - FIREBASE_SERVICE_ACCOUNT         (raw JSON string; multiline supported)
//
// On Vercel, set FIREBASE_SERVICE_ACCOUNT_BASE64 (single env var, no escaping headaches).

import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cached: { app: App; db: Firestore } | null | undefined;

function loadServiceAccount(): Record<string, unknown> | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    } catch (e) {
      console.error("[firebase] Failed to decode FIREBASE_SERVICE_ACCOUNT_BASE64:", e);
      return null;
    }
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
      return null;
    }
  }
  return null;
}

/**
 * Returns a Firestore instance, or null if no service account is configured.
 * Callers should fall back to local stores when null.
 */
export function firestore(): Firestore | null {
  if (cached !== undefined) return cached?.db ?? null;

  const sa = loadServiceAccount();
  if (!sa) {
    cached = null;
    return null;
  }

  try {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert(sa as Parameters<typeof cert>[0]),
      });
    const db = getFirestore(app);
    cached = { app, db };
    return db;
  } catch (e) {
    console.error("[firebase] init failed:", e);
    cached = null;
    return null;
  }
}
