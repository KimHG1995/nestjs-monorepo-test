import { createZodDto } from 'nestjs-zod';

import { CreateProductSchema } from './create-product.dto';

export const UpdateProductSchema = CreateProductSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '수정할 필드를 최소 한 개 이상 제공해야 합니다.' },
);

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
