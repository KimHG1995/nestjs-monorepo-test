import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProductSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, 'SKU는 필수입니다.')
      .max(40, 'SKU는 최대 40자까지 허용됩니다.'),
    name: z
      .string()
      .trim()
      .min(1, '상품명은 필수입니다.')
      .max(120, '상품명은 최대 120자까지 허용됩니다.'),
    priceInMinorUnits: z
      .number()
      .int('가격은 정수여야 합니다.')
      .nonnegative('가격은 0 이상이어야 합니다.'),
    currency: z
      .string()
      .trim()
      .length(3, '통화 코드는 3자리여야 합니다.')
      .default('KRW'),
    stockQuantity: z
      .number()
      .int('재고 수량은 정수여야 합니다.')
      .nonnegative('재고 수량은 0 이상이어야 합니다.')
      .default(0),
  })
  .strict();

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
