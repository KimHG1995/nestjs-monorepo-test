import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const FunnelQuerySchema = z
  .object({
    productId: z.string().uuid('유효한 상품 UUID를 입력해야 합니다.'),
    from: z
      .string()
      .datetime({ message: 'from은 유효한 ISO 8601 날짜/시간이어야 합니다.' }),
    to: z
      .string()
      .datetime({ message: 'to는 유효한 ISO 8601 날짜/시간이어야 합니다.' }),
  })
  .strict()
  .refine((query) => new Date(query.from) < new Date(query.to), {
    message: 'from은 to보다 앞서야 합니다.',
    path: ['from'],
  });

export class FunnelQueryDto extends createZodDto(FunnelQuerySchema) {}
