import { z } from 'zod';

/**
 * Lookups the create-scan wizard needs: the scan-type picker source, the
 * findings definition behind one scan type, and the user's organizations.
 *
 * Separate from schemas/scan-type.ts on purpose. That file models the dynamic
 * FORM definitions a detail page needs to turn stored answers back into
 * labels; this one models what the capture wizard renders, and the two were
 * checked against different live routes. Both shapes below were verified
 * against gusi_dev, and each corrects a legacy schema that would have thrown
 * the moment runtime parsing was switched on:
 *
 *  1. GET /api/scan-type/list sends `{id, name, version, description, imageUrl}`
 *     and NOTHING else — no `key`, no `isActive`. The legacy schema declared
 *     both required.
 *  2. A findings definition carries `type`, `dataType` and `level` as NULLABLE.
 *     Six of the 232 definitions on the local database are section headings
 *     with all three null and no options; `.optional()` alone rejects them.
 */

/** GET /api/scan-type/list */
export const scanTypeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string().optional(),
  version: z.number().optional(),
  description: z.string().nullish(),
  /** Presigned and short-lived. Never persist it. */
  imageUrl: z.string().nullish(),
  image: z.string().nullish(),
});

export type ScanTypeSummary = z.infer<typeof scanTypeSummarySchema>;

const findingParentRefSchema = z.object({
  id: z.string(),
  key: z.string().optional(),
  name: z.string(),
});

export type FindingParentRef = z.infer<typeof findingParentRefSchema>;

/** The grouping header's label, or null when the row stands on its own. */
export function findingParentLabel(
  parent: FindingDefinition['parent'],
): string | null {
  if (!parent || typeof parent === 'string') return null;
  return parent.name;
}

/**
 * One row of the findings form for a scan type.
 *
 * The control to render is decided by `type` AND `dataType` together, never by
 * `type` alone — see `findingControlKind()` in the wizard:
 *
 *   select/toggle + dataType 'array'  -> MULTI-select, value comma-joined
 *   select/toggle + anything else     -> single choice across ALL options
 *                                        (a 3- or 4-option row stays 3- or
 *                                        4-option; it is never collapsed to a
 *                                        checkbox)
 *   input                             -> free text, numeric when dataType is
 *                                        'number'
 *   null                              -> section heading, no control
 */
export const findingDefinitionSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  scanType: z.string().optional(),
  organization: z.string().nullish(),
  /**
   * Grouping header for this row. `/scan-type/:id/items` sends the raw id (or
   * null); `/scan-type/list/full` POPULATES it to `{id, key, name}`. Modelled
   * as a union because a bare `z.string()` rejects every MSK row on /list/full.
   */
  parent: z.union([findingParentRefSchema, z.string()]).nullish(),
  description: z.string().nullish(),
  placeholder: z.string().nullish(),
  prefixLabel: z.string().nullish(),
  suffixLabel: z.string().nullish(),
  source: z.string().nullish(),
  level: z.number().nullish(),
  order: z.number().nullish(),
  required: z.boolean().optional().default(false),
  type: z.string().nullish(),
  dataType: z.string().nullish(),
  options: z.array(z.string()).optional().default([]),
  condition: z.string().nullish(),
  /** The value the "No Pathology" bulk action writes for this row. */
  default: z.string().nullish(),
});

export type FindingDefinition = z.infer<typeof findingDefinitionSchema>;

/**
 * GET /api/scan-type/:id/items and /api/scan-type-org/:id/items.
 *
 * `forms` is passed through unvalidated here: the wizard renders findings, not
 * the org-configurable dynamic forms, and the live form objects from this
 * route carry no `id` key, so a strict form schema rejects real data.
 */
export const findingDefinitionsResponseSchema = z.object({
  items: z.array(findingDefinitionSchema).default([]),
  forms: z.array(z.unknown()).default([]),
});

export type FindingDefinitionsResponse = z.infer<typeof findingDefinitionsResponseSchema>;

/**
 * GET /api/users/:userId/organizations.
 *
 * `settings` is absent on most organizations and explicitly null on others,
 * which is why the three-file nudge reads "no settings" as "has not opted out".
 */
export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  groupCount: z.number().optional(),
  status: z.string().optional(),
  settings: z
    .object({
      hideMinFileCountWarning: z.boolean().nullish(),
    })
    .passthrough()
    .nullish(),
});

export type Organization = z.infer<typeof organizationSchema>;
