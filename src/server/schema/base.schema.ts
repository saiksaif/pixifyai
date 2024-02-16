import { Availability } from '@prisma/client';
import { z } from 'zod';
import { BrowsingMode } from '~/server/common/enums';
import { parseNumericString } from '~/utils/query-string-helpers';

export const getByIdSchema = z.object({ id: z.number() });
export type GetByIdInput = z.infer<typeof getByIdSchema>;

export const getByIdStringSchema = z.object({ id: z.string() });
export type GetByIdStringInput = z.infer<typeof getByIdStringSchema>;

const limit = z.coerce.number().min(1).max(200).default(20);
const page = z.preprocess(parseNumericString, z.number().min(0).default(1));

export type PaginationInput = z.infer<typeof paginationSchema>;
export const paginationSchema = z.object({
  limit,
  page,
});

export const getAllQuerySchema = paginationSchema.extend({
  query: z.string().optional(),
});
export type GetAllSchema = z.infer<typeof getAllQuerySchema>;

export const periodModeSchema = z.enum(['stats', 'published']).default('published');
export type PeriodMode = z.infer<typeof periodModeSchema>;

// type BaseInterface = {
//   id?: number;
// } & Record<string, unknown>;
// type OmitId<T extends BaseInterface> = Omit<T, 'id'>;

// export const isEntity = <T extends BaseInterface>(
//   entity: T
// ): entity is OmitId<T> & { id: number } => !!entity.id;

export type InfiniteQueryInput = z.infer<typeof infiniteQuerySchema>;
export const infiniteQuerySchema = z.object({
  limit,
  cursor: z.number().optional(),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export const userPreferencesSchema = z
  .object({
    browsingMode: z.nativeEnum(BrowsingMode).default(BrowsingMode.SFW),
    excludedTagIds: z.array(z.number()),
    excludedUserIds: z.array(z.number()),
    excludedImageIds: z.array(z.number()),
  })
  .partial();

export const getByEntitySchema = z.object({
  entityType: z.string(),
  entityId: z.preprocess((val) => (Array.isArray(val) ? val : [val]), z.array(z.number())),
});
export type GetByEntityInput = z.infer<typeof getByEntitySchema>;

export const resourceInput = z.object({
  entityType: z.string(),
  entityId: z.number(),
});

export type ResourceInput = z.infer<typeof resourceInput>;

export const supportedAvailabilityResources = [
  'ModelVersion',
  'Article',
  'Post',
  'Model',
  'Collection',
  'Bounty',
] as const;

export type SupportedAvailabilityResources = (typeof supportedAvailabilityResources)[number];

export const availabilitySchema = z.object({
  entityType: z.enum(supportedAvailabilityResources),
  entityId: z.number(),
  availability: z.nativeEnum(Availability),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;
