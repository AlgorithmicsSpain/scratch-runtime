import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;

export type HostMessage =
  | { type: 'HOST_INIT'; version: 1; channel: string; project: ArrayBuffer | null; title: string }
  | { type: 'HOST_SAVE'; version: 1; channel: string };

export type RuntimeMessage =
  | { type: 'RUNTIME_READY'; version: 1; channel: string }
  | { type: 'PROJECT_SAVE'; version: 1; channel: string; project: ArrayBuffer }
  | { type: 'RUNTIME_ERROR'; version: 1; channel: string; message: string };

const base = { version: z.literal(PROTOCOL_VERSION), channel: z.uuid() };
const hostMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...base,
      type: z.literal('HOST_INIT'),
      project: z.union([
        z.null(),
        z.custom<ArrayBuffer>(
          (value) => value instanceof ArrayBuffer && value.byteLength <= MAX_PROJECT_BYTES,
        ),
      ]),
      title: z.string().trim().min(1).max(180),
    })
    .strict(),
  z.object({ ...base, type: z.literal('HOST_SAVE') }).strict(),
]);

export const isHostMessage = (value: unknown): value is HostMessage =>
  hostMessageSchema.safeParse(value).success;
