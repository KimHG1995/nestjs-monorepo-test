import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * 위젯 목록 조회 쿼리 스키마입니다. 쿼리스트링은 항상 문자열이므로
 * `z.coerce` 로 숫자 변환을 수행하며, 잘못된 값은 검증 에러로 정형화됩니다.
 */
export const ListWidgetsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  color: z.enum(['red', 'green', 'blue']).optional(),
});

export class ListWidgetsQueryDto extends createZodDto(ListWidgetsQuerySchema) {}
