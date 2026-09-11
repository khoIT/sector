import type { ApiClient } from '../client';
import type { multipartUploadCompletePayloadSchema } from '../schemas/scan-payloads';
import {
  multipartUploadInitResponseSchema,
  uploadPresignResponseSchema,
  type MultipartUploadInitResponse,
  type UploadPresignResponse,
} from '../schemas/scan-payloads';
import { z } from 'zod';

/**
 * Direct-to-S3 upload.
 *
 * The bytes never touch the API: the server signs a URL and the browser PUTs
 * to it with `putToPresignedUrl` (upload-keys.ts), which deliberately bypasses
 * this client because S3 rejects the Authorization header and answers with no
 * envelope.
 *
 * Names follow the ROUTES, unlike the legacy client where the function called
 * `uploadInit` pointed at the v2 route while `uploadChunk`/`uploadComplete`
 * pointed at the legacy mobile ones.
 */

/** POST /api/scan/v2/upload-presign — single-shot PUT URL for one object. */
export async function uploadPresign(
  client: ApiClient,
  input: { scanId: string; key: string; contentType: string },
  signal?: AbortSignal,
): Promise<UploadPresignResponse> {
  return client.post('/api/scan/v2/upload-presign', {
    body: input,
    schema: uploadPresignResponseSchema,
    signal,
  });
}

/** POST /api/scan/v2/upload-init — begin a multipart upload. */
export async function multipartUploadInit(
  client: ApiClient,
  input: { scanId: string; key: string; contentType: string; totalParts?: number },
  signal?: AbortSignal,
): Promise<MultipartUploadInitResponse> {
  return client.post('/api/scan/v2/upload-init', {
    body: input,
    schema: multipartUploadInitResponseSchema,
    signal,
  });
}

/** POST /api/scan/upload-chunk — presign one part of a multipart upload. */
export async function multipartUploadPart(
  client: ApiClient,
  input: { key: string; uploadId: string; partNumber: number },
  signal?: AbortSignal,
): Promise<string> {
  return client.post('/api/scan/upload-chunk', {
    body: input,
    schema: z.string(),
    signal,
  });
}

/** POST /api/scan/upload-complete — assemble the parts. */
export async function multipartUploadComplete(
  client: ApiClient,
  input: z.infer<typeof multipartUploadCompletePayloadSchema>,
  signal?: AbortSignal,
): Promise<{ key: string }> {
  return client.post('/api/scan/upload-complete', {
    body: input,
    schema: z.object({ key: z.string() }),
    signal,
  });
}
