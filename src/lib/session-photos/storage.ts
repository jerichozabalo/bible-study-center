/**
 * Cloudflare R2 for session photos — the Print Invox shape
 * (`~/print-invox/src/lib/storage.ts`): one private bucket with no public URL,
 * every object reached through a signed URL or our own code.
 *
 * Two deliberate differences from Print Invox:
 *
 * 1. **The client is an interface** (`PhotoStorage`), not module-level
 *    functions. The module's tests run against a mock that records every call,
 *    so nothing in the test suite ever talks to Cloudflare.
 * 2. **No env read at import time.** The S3 client is built lazily inside
 *    `r2Storage()`, so a test — or a page the leader opens before the bucket
 *    exists — can import this file without credentials.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Long enough to load a screen, short enough that a leaked URL dies quickly. */
export const SIGNED_URL_TTL_SECONDS = 300;

/** What this app asks of object storage — the seam the tests mock. */
export type PhotoStorage = {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Best-effort multi-key removal; a lingering object is private and harmless. */
  remove(keys: string[]): Promise<void>;
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — R2 storage is unconfigured`);
  return value;
}

/** Whether the four R2 vars are present — the page says so plainly when not. */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

let client: S3Client | undefined;
let bucketName: string | undefined;

function s3(): { client: S3Client; bucket: string } {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
    bucketName = required("R2_BUCKET");
  }
  return { client, bucket: bucketName! };
}

/** The real thing. Uploads are `image/jpeg` only — the browser prepares them. */
export function r2Storage(): PhotoStorage {
  return {
    async put(key, body, contentType) {
      const { client: c, bucket } = s3();
      await c.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },

    async remove(keys) {
      const { client: c, bucket } = s3();
      for (const key of keys) {
        await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      }
    },

    async signedUrl(key, expiresInSeconds = SIGNED_URL_TTL_SECONDS) {
      const { client: c, bucket } = s3();
      return await getSignedUrl(
        c,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    },
  };
}
