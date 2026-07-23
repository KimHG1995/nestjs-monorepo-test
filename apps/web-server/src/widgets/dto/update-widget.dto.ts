import { createZodDto } from 'nestjs-zod';

import { CreateWidgetSchema } from './create-widget.dto';

/**
 * 위젯 부분 수정 요청 스키마입니다. 생성 스키마의 모든 필드를 선택적으로 만듭니다.
 * 최소 한 개 이상의 필드가 있어야 합니다.
 */
export const UpdateWidgetSchema = CreateWidgetSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '수정할 필드를 최소 한 개 이상 제공해야 합니다.' },
);

export class UpdateWidgetDto extends createZodDto(UpdateWidgetSchema) {}
