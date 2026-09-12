import { z } from 'zod';

/**
 * User activity logs — `POST /api/user-logs`.
 *
 * These are what a scan's `scanLogs` point at, and the API reads them twice:
 * it renders them into the submission email, and the scan detail page's
 * Activity log lists them. A scan whose `scanLogs` is empty gets NO email at
 * all — `scan.controller.ts` guards the owner notification on
 * `updatedScan.scanLogs.length > 0` — so writing these is not bookkeeping, it
 * is the difference between a submitted study the learner hears about and one
 * they do not.
 */

export const USER_LOG_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
export type UserLogSeverity = (typeof USER_LOG_SEVERITIES)[number];

export const userLogEntrySchema = z.object({
  /** Dotted verb, e.g. `scan.submit`. Free text on the wire; kept short here. */
  action: z.string().min(1),
  message: z.string(),
  severity: z.enum(USER_LOG_SEVERITIES),
  /** The user the log is ABOUT. The author is taken from the bearer token. */
  user: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type UserLogEntry = z.infer<typeof userLogEntrySchema>;

/**
 * The envelope's `data` is the created documents; only the ids are used, and a
 * passthrough keeps the rest from failing the parse when the model grows.
 */
export const createUserLogsResponseSchema = z
  .array(z.object({ id: z.string() }).passthrough())
  .default([]);
