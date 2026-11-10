import { z } from "zod";

export const contentModelSchema = z
  .object({
    version: z.literal(1),
    appId: z.string().min(1),
    locale: z.string().min(2),
    messages: z.record(z.string(), z.string()),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();

export type ContentModel = z.infer<typeof contentModelSchema>;
export type MessageValues = Record<string, string | number>;
export type Translate = (key: string, values?: MessageValues) => string;

export function dataString(model: ContentModel, key: string): string {
  const value = model.data[key];
  if (typeof value !== "string") throw new Error(`CONTENT_DATA_INVALID:${key}`);
  return value;
}

export function dataStringRecord(model: ContentModel, key: string): Record<string, string> {
  const parsed = z.record(z.string(), z.string()).safeParse(model.data[key]);
  if (!parsed.success) throw new Error(`CONTENT_DATA_INVALID:${key}`);
  return parsed.data;
}

export function dataStringArray(model: ContentModel, key: string): string[] {
  const parsed = z.array(z.string()).safeParse(model.data[key]);
  if (!parsed.success) throw new Error(`CONTENT_DATA_INVALID:${key}`);
  return parsed.data;
}

export function dataStringFrom(model: ContentModel, key: string, itemKey: string): string {
  const record = z.record(z.string(), z.string()).safeParse(model.data[key]);
  const value = record.success ? record.data[itemKey] : undefined;
  if (typeof value !== "string") throw new Error(`CONTENT_DATA_INVALID:${key}.${itemKey}`);
  return value;
}

export function dataStringAt(model: ContentModel, key: string, itemKey: string, field: string): string {
  const record = z.record(z.string(), z.unknown()).safeParse(model.data[key]);
  const item = record.success ? z.record(z.string(), z.unknown()).safeParse(record.data[itemKey]) : null;
  const value = item?.success ? item.data[field] : undefined;
  if (typeof value !== "string") throw new Error(`CONTENT_DATA_INVALID:${key}.${itemKey}.${field}`);
  return value;
}

export function dataStringOr(model: ContentModel, key: string, itemKey: string, fallback: string): string {
  const record = z.record(z.string(), z.unknown()).safeParse(model.data[key]);
  if (!record.success) throw new Error(`CONTENT_DATA_INVALID:${key}`);
  const value = record.data[itemKey];
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new Error(`CONTENT_DATA_INVALID:${key}.${itemKey}`);
  return value;
}

export function errorMessage(model: ContentModel, translate: Translate, error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  const key = code ? `errors.${code}` : "errors.requestFailed";
  return Object.hasOwn(model.messages, key) ? translate(key) : translate("errors.requestFailed");
}
