import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";

/**
 * Firestore admin client — named database `spa-owner-2` inside the existing
 * `spaowner` GCP project (no new project: billing-quota discipline). Local
 * dev authenticates via ADC (`gcloud auth application-default login`).
 */

let instance: Firestore | null = null;

export function db(): Firestore {
  if (instance) return instance;
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "spaowner",
    });
  }
  const id = process.env.FIRESTORE_DATABASE_ID || "spa-owner-2";
  instance = getFirestore(id);
  try {
    instance.settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    if (!String(err).includes("already been initialized")) throw err;
  }
  return instance;
}

export { Timestamp, FieldValue };
export const now = () => Timestamp.now();
