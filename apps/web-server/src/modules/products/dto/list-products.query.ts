import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
});

export class ListProductsQueryDto extends createZodDto(
  ListProductsQuerySchema,
) {}
