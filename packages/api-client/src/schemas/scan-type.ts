import { z } from 'zod';

/**
 * Scan-type findings rows and the org-configurable dynamic form definitions —
 * GET /api/scan-type/:id/items.
 *
 * These are what turn stored answers back into something a human can read. A
 * scan's `findings[]` carry a machine `key` (`v5_echo_ejection_fraction`) and a
 * scan's `form[]` answers carry only `{ formId, scanFormFieldId, value }`, so
 * without these definitions a detail page can show nothing but opaque ids.
 *
 * Shapes read off the live response on 2026-09-11 (local gusi_dev). The scan
 * type PICKER and the organization list live in `schemas/create-scan-lookups.ts`;
 * this file is only the definitions a detail page needs.
 */

export const SCAN_FORM_FIELD_TYPES = [
  'text',
  'checkbox',
  'number',
  'textarea',
  'phone',
  'select',
  'dropdown',
  'date',
  'email',
  'radio',
] as const;

export const scanFormFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export type ScanFormFieldOption = z.infer<typeof scanFormFieldOptionSchema>;

/**
 * The dynamic-form field, defined ONCE. The legacy schema file inlined a second
 * copy of this whole definition for the organization-forms response, and the
 * copy had already drifted (it omitted groupId/groupLabel).
 *
 * `fieldType` is `z.string()`, not the 10-value enum the legacy client
 * declared: the type list is org-configurable data, not a wire contract, so a
 * new type added in the admin UI would otherwise make every scan detail page
 * fail to parse. SCAN_FORM_FIELD_TYPES lists the values seen so far.
 */
export const scanFormFieldSchema = z.object({
  id: z.string(),
  /** Stable machine key, e.g. `v6_vascular_view`. Not the mongo id. */
  fieldId: z.string().optional(),
  fieldName: z.string().optional(),
  label: z.string().optional(),
  fieldType: z.string(),
  options: z.array(scanFormFieldOptionSchema).default([]),
  order: z.number().optional(),
  required: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  groupId: z.string().nullish(),
  groupLabel: z.string().nullish(),
});

export type ScanFormField = z.infer<typeof scanFormFieldSchema>;

export const scanFormSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().nullish(),
  /** pre-scan | scan | post-scan | general — which capture step it belongs to. */
  formPhase: z.string().optional(),
  displayMode: z.string().optional(),
  order: z.number().optional(),
  fields: z.array(scanFormFieldSchema).default([]),
});

export type ScanForm = z.infer<typeof scanFormSchema>;

/**
 * One findings row definition. `key` is what a scan's `findings[].key` points
 * at; `name` is the label to show. `options` is a flat string array here,
 * unlike the {value,label} objects on a dynamic-form field.
 */
export const scanTypeItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  parent: z.string().nullish(),
  level: z.number().optional(),
  order: z.number().optional(),
  type: z.string().optional(),
  dataType: z.string().optional(),
  source: z.string().nullish(),
  prefixLabel: z.string().nullish(),
  suffixLabel: z.string().nullish(),
  options: z.array(z.string()).default([]),
  required: z.boolean().optional(),
});

export type ScanTypeItem = z.infer<typeof scanTypeItemSchema>;

/** GET /api/scan-type/:id/items */
export const scanTypeItemsSchema = z.object({
  items: z.array(scanTypeItemSchema).default([]),
  forms: z.array(scanFormSchema).default([]),
});

export type ScanTypeItems = z.infer<typeof scanTypeItemsSchema>;
