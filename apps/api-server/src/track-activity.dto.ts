import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TrackActivitySchema = z.object({
  userId: z.string().uuid('userId에 유효하지 않은 UUID 형식입니다.'),
  activityType: z.enum(['login', 'logout', 'view_product', 'add_to_cart']),
  details: z
    .record(z.any())
    .optional()
    .describe('활동에 대한 추가적인 세부 정보'),
  timestamp: z
    .string()
    .datetime({ message: '유효하지 않은 ISO 8601 날짜/시간 형식입니다.' }),
});

/**
 * Zod 스키마로부터 생성된 데이터 전송 객체(DTO) 클래스입니다.
 * `nestjs-zod`를 통해 들어오는 요청의 유효성을 검사하는 데 사용됩니다.
 */
export class TrackActivityDto extends createZodDto(TrackActivitySchema) {}
