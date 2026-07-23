import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * 위젯 생성 요청 스키마입니다. 전역 `ZodValidationPipe` 가 이 스키마로 요청 본문을 검증하며,
 * 검증 실패 시 `AllExceptionsFilter` 가 RFC 7807 형식으로 에러를 정형화합니다.
 */
export const CreateWidgetSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, '이름은 최소 1자 이상이어야 합니다.')
      .max(80, '이름은 최대 80자까지 허용됩니다.'),
    color: z.enum(['red', 'green', 'blue'], {
      errorMap: () => ({
        message: 'color 는 red, green, blue 중 하나여야 합니다.',
      }),
    }),
    quantity: z
      .number()
      .int('수량은 정수여야 합니다.')
      .nonnegative('수량은 0 이상이어야 합니다.')
      .default(0),
    tags: z.array(z.string().min(1)).max(10).default([]),
  })
  .strict();

export class CreateWidgetDto extends createZodDto(CreateWidgetSchema) {}
