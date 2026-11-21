import "server-only";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Writable folder for the SQLite file, uploads and the dev session secret.
 * Serverless hosts (Vercel, Lambda) mount the app read-only, so fall back to the temp dir there.
 * Data in the temp dir is per-instance and is lost on cold start: fine for a demo, not for real orders.
 */
export function dataDir(): string {
  if (process.env.EMPORIUM_DATA_DIR) return process.env.EMPORIUM_DATA_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return join(tmpdir(), "emporium");
  return join(process.cwd(), "data");
}
